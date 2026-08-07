/**
 * Jedno zrodlo prawdy o kosztach rezerwacji.
 *
 * Wczesniej kazde miejsce liczylo koszty po swojemu: mail pokazywal najem i
 * dostawe, panel sama "cene bazowa", a umowa jedna kwote laczna. Doplata za
 * weekend i rabat nie pojawialy sie nigdzie, wiec suma nie zgadzala sie z
 * pozycjami i klient nie wiedzial, za co placi. Umowa i dowod zakupu to
 * miejsca, w ktorych taka watpliwosc jest niedopuszczalna.
 *
 * Kazdy odbiorca (mail, panel, PDF umowy, strefa klienta) sklada rozpis z tej
 * jednej funkcji, wiec wszedzie widac te same pozycje i te sama sume.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export type PozycjaKosztu = {
  /** Klucz techniczny, po nim mozna rozpoznac pozycje bez parsowania etykiety. */
  klucz: 'najem' | 'dostawa' | 'weekend' | 'rabat' | `dodatek-${string}`;
  etykieta: string;
  /** Skad ta kwota - zeby klient nie musial zgadywac. */
  opis?: string;
  kwota: number;
};

export type RozpisKosztow = {
  pozycje: PozycjaKosztu[];
  suma: number;
  /** Ustawione, gdy pracownik recznie nadpisal cene - suma pozycji jest wtedy inna. */
  korektaReczna: { kwota: number; powod: string } | null;
  kaucja: number;
};

/** Surowe pola rezerwacji uzywane do rozpisu - tyle wystarczy, zeby go zlozyc. */
export type ZrodloKosztow = {
  days: number;
  base_price: number | string;
  delivery_fee: number | string | null;
  weekend_fee?: number | string | null;
  total_price: number | string;
  discount_amount?: number | string | null;
  discount_label?: string | null;
  discount_code?: string | null;
  price_override_note?: string | null;
  delivery?: number | boolean | null;
  delivery_out?: number | boolean | null;
  delivery_back?: number | boolean | null;
  addons?: unknown;
  addons_fee?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  deposit?: number | string | null;
};

const liczba = (wartosc: unknown): number => {
  const n = Number(wartosc ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const doba = (dni: number) => (dni === 1 ? 'doba' : dni < 5 ? 'doby' : 'dób');

/**
 * Sklada pelny rozpis kosztow rezerwacji.
 *
 * Suma to zawsze wartosc z `total_price`, bo to ona zostala klientowi
 * przedstawiona i to ja zaplaci. Jesli pozycje nie skladaja sie na te kwote,
 * roznica jest pokazana jawnie jako korekta pracownika - zamiast po cichu
 * rozjechac sie z tym, co klient widzi.
 */
export function rozpiszKoszty(rezerwacja: ZrodloKosztow): RozpisKosztow {
  const dni = Math.max(1, Math.round(liczba(rezerwacja.days)) || 1);
  const najem = round2(liczba(rezerwacja.base_price));
  const dostawa = round2(liczba(rezerwacja.delivery_fee));
  const weekend = round2(liczba(rezerwacja.weekend_fee));
  const rabat = round2(liczba(rezerwacja.discount_amount));
  const suma = round2(liczba(rezerwacja.total_price));

  const pozycje: PozycjaKosztu[] = [
    {
      klucz: 'najem',
      etykieta: `Najem sprzętu (${dni} ${doba(dni)})`,
      kwota: najem,
    },
  ];

  if (rabat > 0) {
    const nazwa = rezerwacja.discount_label?.trim();
    const kod = rezerwacja.discount_code?.trim();
    pozycje.push({
      klucz: 'rabat',
      etykieta: 'Rabat',
      opis: [nazwa, kod ? `kod ${kod}` : null].filter(Boolean).join(', ') || undefined,
      kwota: -rabat,
    });
  }

  if (dostawa > 0) {
    const dowoz = Boolean(Number(rezerwacja.delivery_out ?? rezerwacja.delivery ?? 0));
    const odbior = Boolean(Number(rezerwacja.delivery_back ?? rezerwacja.delivery ?? 0));
    const kursy = [dowoz ? 'dowóz do Ciebie' : null, odbior ? 'odbiór od Ciebie' : null].filter(Boolean);
    pozycje.push({
      klucz: 'dostawa',
      etykieta: kursy.length === 2 ? 'Dowóz i odbiór sprzętu' : dowoz ? 'Dowóz sprzętu' : 'Odbiór sprzętu',
      opis: kursy.length > 0 ? kursy.join(', ') : 'transport pod wskazany adres',
      kwota: dostawa,
    });
  }

  if (weekend > 0) {
    const weekendowy = (data: string | null | undefined) => {
      if (!data) return false;
      const d = new Date(`${String(data).slice(0, 10)}T12:00:00`).getDay();
      return d === 0 || d === 6;
    };
    const zdarzenia = [
      weekendowy(rezerwacja.start_date) ? 'wydanie' : null,
      weekendowy(rezerwacja.end_date) ? 'zwrot' : null,
    ].filter(Boolean);
    pozycje.push({
      klucz: 'weekend',
      etykieta: 'Obsługa w weekend',
      opis: zdarzenia.length > 0
        ? `${zdarzenia.join(' i ')} w sobotę, niedzielę lub święto`
        : 'wydanie lub zwrot w sobotę, niedzielę lub święto',
      kwota: weekend,
    });
  }

  // Każdy dodatek osobno — klient ma widzieć, za co zapłacił, a nie zbiorczą
  // kwotę „dodatki", której nie da się sprawdzić.
  const dodatki = Array.isArray(rezerwacja.addons) ? rezerwacja.addons : [];
  for (const dodatek of dodatki as Array<Record<string, unknown>>) {
    const kwota = round2(liczba(dodatek?.suma));
    if (!(kwota > 0)) continue;
    const ilosc = Math.max(1, Math.round(liczba(dodatek?.ilosc)) || 1);
    const cena = round2(liczba(dodatek?.cena));
    pozycje.push({
      klucz: `dodatek-${String(dodatek?.id ?? '')}`,
      etykieta: String(dodatek?.nazwa ?? 'Dodatek'),
      opis: `${ilosc} × ${cena.toFixed(2)} zł`,
      kwota,
    });
  }

  const sumaPozycji = round2(pozycje.reduce((s, p) => s + p.kwota, 0));
  const roznica = round2(suma - sumaPozycji);

  return {
    pozycje,
    suma,
    korektaReczna:
      Math.abs(roznica) >= 0.01
        ? {
            kwota: roznica,
            powod: rezerwacja.price_override_note?.trim() || 'Indywidualne ustalenie ceny',
          }
        : null,
    kaucja: round2(liczba(rezerwacja.deposit)),
  };
}

export const zloty = (kwota: number): string =>
  `${kwota.toFixed(2).replace('.', ',')} zł`;

/** Rozpis jako linie tekstu - do PDF i do wersji tekstowej maila. */
export function rozpisJakoLinie(rozpis: RozpisKosztow): Array<{ etykieta: string; kwota: string }> {
  const linie = rozpis.pozycje.map((p) => ({
    etykieta: p.opis ? `${p.etykieta} (${p.opis})` : p.etykieta,
    kwota: zloty(p.kwota),
  }));
  if (rozpis.korektaReczna) {
    linie.push({
      etykieta: rozpis.korektaReczna.powod,
      kwota: zloty(rozpis.korektaReczna.kwota),
    });
  }
  return linie;
}
