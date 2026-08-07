/**
 * Przedłużenie najmu.
 *
 * Umowa (§5 ust. 3): przedłużenie wymaga zapłaty z góry, a brak zapłaty
 * w terminie oznacza brak skutecznego przedłużenia. Te testy pilnują, żeby
 * aneks nie zmieniał niczego przed wpłatą i żeby sprzęt nie został podwójnie
 * zajęty w czasie, gdy klient płaci.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.NODE_ENV = 'test';

const rezerwacja = {
  id: 1,
  product_id: 'puzzi-10-1',
  items: [{ product_id: 'puzzi-10-1' }],
  email: 'k@example.com',
  name: 'Anna Kowalczyk',
  status: 'picked_up',
  is_indefinite: false,
  start_date: '2026-08-10',
  start_time: '09:00',
  end_date: '2026-08-12',
  end_time: '09:00',
  days: 2,
  base_price: 90,
  total_price: 130,
};

const stan: {
  rezerwacja: any;
  aneksy: any[];
  kolizje: any[] | null;
  bramkaDziala: boolean;
} = { rezerwacja: { ...rezerwacja }, aneksy: [], kolizje: null, bramkaDziala: true };

vi.mock('../src/db.js', () => ({
  queries: {
    getReservationById: async (id: number) => (id === stan.rezerwacja.id ? stan.rezerwacja : null),
    getExtensionsForReservation: async () => stan.aneksy,
    createRentalExtension: async (dane: any) => {
      const otwarty = stan.aneksy.find((a) => a.status === 'pending' && Date.parse(a.expires_at) > Date.now());
      if (otwarty) return { blocked: 'Masz już rozpoczęte przedłużenie — dokończ płatność albo poczekaj, aż wygaśnie' };
      if (stan.kolizje) return { conflicts: stan.kolizje };
      const aneks = {
        id: stan.aneksy.length + 1,
        ...dane,
        status: 'pending',
        expires_at: new Date(Date.now() + dane.minutNaPlatnosc * 60_000).toISOString(),
      };
      stan.aneksy.push(aneks);
      return { extension: aneks };
    },
    attachExtensionPayment: async (id: number, sessionId: string) => {
      const a = stan.aneksy.find((x) => x.id === id);
      if (a) a.payment_session_id = sessionId;
    },
    activateRentalExtension: async (sessionId: string) => {
      const a = stan.aneksy.find((x) => x.payment_session_id === sessionId);
      if (!a || a.status !== 'pending') return null;
      a.status = 'paid';
      stan.rezerwacja = {
        ...stan.rezerwacja,
        end_date: a.newEndDate,
        end_time: a.newEndTime,
        days: a.newDays,
        base_price: a.newBasePrice,
        total_price: a.newTotal,
      };
      return { extension: a, reservation: stan.rezerwacja };
    },
    insertPayment: async () => ({ lastInsertRowid: 1 }),
  },
}));

vi.mock('../src/payments/index.js', () => ({
  getActiveProvider: () => (stan.bramkaDziala
    ? {
        name: 'testowy',
        createPayment: async (input: any) => ({
          redirectUrl: `https://bramka.test/${input.sessionId}?kwota=${input.amount}`,
          externalId: 'ext-1',
        }),
      }
    : null),
  getProviderByName: () => null,
}));

const { wycenPrzedluzenie, rozpocznijPrzedluzenie, aktywujPrzedluzenie, MINUT_NA_PLATNOSC } =
  await import('../src/rental-extensions.js');

beforeEach(() => {
  stan.rezerwacja = { ...rezerwacja };
  stan.aneksy = [];
  stan.kolizje = null;
  stan.bramkaDziala = true;
});

describe('wycena przedłużenia', () => {
  it('liczy dopłatę jako różnicę wobec dotychczasowej kwoty', async () => {
    const wynik = await wycenPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' });
    expect(wynik.ok).toBe(true);
    if (!wynik.ok) return;
    expect(wynik.wycena.doplata).toBeGreaterThan(0);
    expect(wynik.wycena.nowaKwota).toBe(wynik.wycena.dotychczasowaKwota + wynik.wycena.doplata);
  });

  it('zachowuje raz zapłacone opłaty stałe zamiast liczyć je drugi raz', async () => {
    const wynik = await wycenPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' });
    if (!wynik.ok) throw new Error(wynik.powod);
    // Dostawa i weekend (130 - 90 = 40) mają zostać nietknięte.
    const oplatyStale = rezerwacja.total_price - rezerwacja.base_price;
    expect(wynik.wycena.nowaKwota - oplatyStale).toBeGreaterThan(rezerwacja.base_price);
  });

  it('podaje nowy termin z dniem tygodnia', async () => {
    const wynik = await wycenPrzedluzenie(1, { newEndDate: '2026-08-15', newEndTime: '09:00' });
    if (!wynik.ok) throw new Error(wynik.powod);
    expect(wynik.wycena.nowyTermin?.dzienTygodnia).toBe('sobota');
  });

  it('odmawia terminu wcześniejszego albo równego obecnemu', async () => {
    for (const data of ['2026-08-12', '2026-08-11']) {
      const wynik = await wycenPrzedluzenie(1, { newEndDate: data, newEndTime: '09:00' });
      expect(wynik.ok).toBe(false);
      if (!wynik.ok) expect(wynik.powod).toMatch(/p\u00f3\u017aniejszy/);
    }
  });

  it('nie przedłuża najmu, który się nie zaczął ani nie jest zakończony', async () => {
    for (const status of ['pending', 'returned', 'completed', 'cancelled']) {
      stan.rezerwacja = { ...rezerwacja, status };
      const wynik = await wycenPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' });
      expect(wynik.ok).toBe(false);
    }
  });

  it('najem bezterminowy nie wymaga przedłużania', async () => {
    stan.rezerwacja = { ...rezerwacja, is_indefinite: true };
    const wynik = await wycenPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' });
    expect(wynik.ok).toBe(false);
    if (!wynik.ok) expect(wynik.powod).toMatch(/bezterminowy/);
  });
});

describe('rozpoczęcie przedłużenia', () => {
  it('tworzy aneks i płatność na kwotę dopłaty, nie na cały najem', async () => {
    const wynik = await rozpocznijPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' }, '127.0.0.1');
    expect(wynik.ok).toBe(true);
    if (!wynik.ok) return;
    expect(wynik.platnosc.redirectUrl).toContain(`kwota=${wynik.wycena.doplata}`);
    expect(wynik.aneks.numer).toMatch(/\/A1$/);
  });

  it('do czasu zapłaty termin rezerwacji zostaje nietknięty', async () => {
    await rozpocznijPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' }, '127.0.0.1');
    expect(stan.rezerwacja.end_date).toBe('2026-08-12');
    expect(stan.rezerwacja.total_price).toBe(130);
  });

  it('nie pozwala rozpocząć drugiego przedłużenia w trakcie płatności', async () => {
    await rozpocznijPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' }, '127.0.0.1');
    const drugi = await rozpocznijPrzedluzenie(1, { newEndDate: '2026-08-16', newEndTime: '09:00' }, '127.0.0.1');
    expect(drugi.ok).toBe(false);
    if (!drugi.ok) expect(drugi.powod).toMatch(/rozpocz\u0119te przed\u0142u\u017cenie/);
  });

  it('zajęty sprzęt blokuje przedłużenie z czytelnym powodem', async () => {
    stan.kolizje = [{ product_id: 'puzzi-10-1' }];
    const wynik = await rozpocznijPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' }, '127.0.0.1');
    expect(wynik.ok).toBe(false);
    if (!wynik.ok) expect(wynik.powod).toMatch(/zarezerwowany/);
  });

  it('wyłączona bramka kieruje do kontaktu zamiast zostawiać bez wyjścia', async () => {
    stan.bramkaDziala = false;
    const wynik = await rozpocznijPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' }, '127.0.0.1');
    expect(wynik.ok).toBe(false);
    if (!wynik.ok) expect(wynik.powod).toMatch(/570 038 828/);
  });

  it('blokada sprzętu wygasa po ustalonym czasie', async () => {
    const wynik = await rozpocznijPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' }, '127.0.0.1');
    if (!wynik.ok) throw new Error(wynik.powod);
    const zostalo = Date.parse(wynik.wygasa) - Date.now();
    expect(zostalo).toBeGreaterThan((MINUT_NA_PLATNOSC - 2) * 60_000);
    expect(zostalo).toBeLessThanOrEqual(MINUT_NA_PLATNOSC * 60_000);
  });
});

describe('aneks wchodzi w życie dopiero po zapłacie', () => {
  it('zapłata przesuwa termin i podnosi kwotę najmu', async () => {
    const start = await rozpocznijPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' }, '127.0.0.1');
    if (!start.ok) throw new Error(start.powod);

    const wynik = await aktywujPrzedluzenie(start.platnosc.sessionId);
    expect(wynik).not.toBeNull();
    expect(stan.rezerwacja.end_date).toBe('2026-08-14');
    expect(stan.rezerwacja.total_price).toBe(start.wycena.nowaKwota);
  });

  it('powtórne powiadomienie z bramki nie zmienia niczego drugi raz', async () => {
    const start = await rozpocznijPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' }, '127.0.0.1');
    if (!start.ok) throw new Error(start.powod);
    await aktywujPrzedluzenie(start.platnosc.sessionId);
    const powtorka = await aktywujPrzedluzenie(start.platnosc.sessionId);
    expect(powtorka).toBeNull();
  });

  it('nieznana sesja płatności nie aktywuje żadnego aneksu', async () => {
    await rozpocznijPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' }, '127.0.0.1');
    expect(await aktywujPrzedluzenie('obca-sesja')).toBeNull();
    expect(stan.rezerwacja.end_date).toBe('2026-08-12');
  });

  it('po opłaceniu można rozpocząć kolejne przedłużenie', async () => {
    const pierwszy = await rozpocznijPrzedluzenie(1, { newEndDate: '2026-08-14', newEndTime: '09:00' }, '127.0.0.1');
    if (!pierwszy.ok) throw new Error(pierwszy.powod);
    await aktywujPrzedluzenie(pierwszy.platnosc.sessionId);

    const drugi = await rozpocznijPrzedluzenie(1, { newEndDate: '2026-08-17', newEndTime: '09:00' }, '127.0.0.1');
    expect(drugi.ok).toBe(true);
    if (drugi.ok) expect(drugi.aneks.numer).toMatch(/\/A2$/);
  });
});
