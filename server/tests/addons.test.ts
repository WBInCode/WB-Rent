/**
 * Płatne dodatki: worki, środki czyszczące.
 *
 * Wcześniej lista dodatków była wyłącznie opisem na stronie produktu, a cała
 * lista dzieliła jedną cenę (`accessory_price`) — worek za 15 zł i środek za
 * 3 zł nie mieściły się w takim modelu. Teraz cena stoi przy pozycji, a klient
 * może je zamówić przy rezerwacji.
 */
import { describe, it, expect } from 'vitest';
import { addonId, normalizeAddons, priceAddons } from '../src/products.js';
import { totalWithDiscount } from '../src/pricing.js';
import { rozpiszKoszty } from '../src/costs.js';

describe('identyfikator dodatku', () => {
  it('nie gubi polskich znaków przy sprowadzaniu do ASCII', () => {
    expect(addonId('Środek do dezynfekcji RM 735')).toBe('srodek-do-dezynfekcji-rm-735');
    expect(addonId('Wkłady piorące')).toBe('wklady-piorace');
  });

  it('ten sam tekst daje ten sam klucz niezależnie od zapisu', () => {
    expect(addonId('Worki do odkurzacza')).toBe(addonId('worki  do   odkurzacza'));
  });
});

describe('sprowadzanie dodatków do jednej postaci', () => {
  it('starszy zapis (same nazwy) przejmuje wspólną cenę sprzętu', () => {
    expect(normalizeAddons(['Worki do odkurzacza'], 15)).toEqual([
      { id: 'worki-do-odkurzacza', nazwa: 'Worki do odkurzacza', cena: 15 },
    ]);
  });

  it('nowszy zapis zachowuje cenę przy pozycji', () => {
    const wynik = normalizeAddons([
      { nazwa: 'Worek', cena: 15 },
      { nazwa: 'Środek RM 780', cena: 10 },
    ], 99);
    expect(wynik.map((d) => d.cena)).toEqual([15, 10]);
  });

  it('pomija puste nazwy i duplikaty, zamiast tworzyć pozycje-widma', () => {
    const wynik = normalizeAddons([{ nazwa: '  ', cena: 5 }, 'Worek', { nazwa: 'worek', cena: 30 }], 15);
    expect(wynik).toHaveLength(1);
    expect(wynik[0].cena).toBe(15);
  });

  it('brak ceny to zero, a nie NaN w podsumowaniu', () => {
    expect(normalizeAddons([{ nazwa: 'Płyn', cena: Number.NaN }])[0].cena).toBe(0);
    expect(normalizeAddons(['Płyn'])[0].cena).toBe(0);
  });
});

describe('wycena zamówionych dodatków', () => {
  const katalog = [
    { productId: 'nt-22-1', dodatki: normalizeAddons([{ nazwa: 'Worki do odkurzacza', cena: 15 }]) },
    { productId: 'wvp-10-adv', dodatki: normalizeAddons([{ nazwa: 'Środek do szyb', cena: 0 }]) },
  ];

  it('mnoży cenę katalogową przez ilość', () => {
    const wynik = priceAddons(katalog, [{ id: 'worki-do-odkurzacza', quantity: 3 }]);
    expect(wynik).toEqual({
      items: [{ productId: 'nt-22-1', id: 'worki-do-odkurzacza', nazwa: 'Worki do odkurzacza', cena: 15, ilosc: 3, suma: 45 }],
      fee: 45,
    });
  });

  it('odrzuca dodatek, którego nie ma w katalogu zamawianego sprzętu', () => {
    expect(priceAddons(katalog, [{ id: 'zloty-worek', quantity: 1 }]))
      .toEqual({ error: 'Wybrany dodatek nie jest dostępny do tego sprzętu' });
  });

  it('nie sprzedaje pozycji bez ustalonej ceny', () => {
    const wynik = priceAddons(katalog, [{ id: 'srodek-do-szyb', quantity: 1 }]);
    expect('error' in wynik && wynik.error).toContain('nie ma jeszcze ustalonej ceny');
  });

  it('ilość zero i ujemna nie tworzą pozycji', () => {
    expect(priceAddons(katalog, [
      { id: 'worki-do-odkurzacza', quantity: 0 },
      { id: 'worki-do-odkurzacza', quantity: -5 },
    ])).toEqual({ items: [], fee: 0 });
  });

  it('ta sama pozycja przysłana dwa razy sumuje się w jedną', () => {
    const wynik = priceAddons(katalog, [
      { id: 'worki-do-odkurzacza', quantity: 2 },
      { id: 'worki-do-odkurzacza', quantity: 1 },
    ]);
    expect('items' in wynik && wynik.items).toHaveLength(1);
    expect('fee' in wynik && wynik.fee).toBe(45);
  });
});

describe('dodatki w sumie zamówienia', () => {
  it('doliczają się do sumy', () => {
    expect(totalWithDiscount({ basePrice: 90, deliveryFee: 40, weekendPickupFee: 0, addonsFee: 15, discountAmount: 0 }))
      .toBe(145);
  });

  it('rabat na najem ich nie obniża — to sprzedaż towaru, nie usługa najmu', () => {
    expect(totalWithDiscount({ basePrice: 90, deliveryFee: 0, weekendPickupFee: 0, addonsFee: 15, discountAmount: 90 }))
      .toBe(15);
  });

  it('brak dodatków liczy się tak samo jak dotąd', () => {
    expect(totalWithDiscount({ basePrice: 90, deliveryFee: 40, weekendPickupFee: 30, discountAmount: 0 }))
      .toBe(160);
  });
});

describe('dodatki w rozpisie kosztów', () => {
  const podstawa = {
    days: 2,
    base_price: 90,
    delivery_fee: 0,
    weekend_fee: 0,
    total_price: 135,
  };

  it('każdy dodatek jest osobną pozycją z ilością i ceną jednostkową', () => {
    const rozpis = rozpiszKoszty({
      ...podstawa,
      addons: [{ id: 'worki-do-odkurzacza', nazwa: 'Worki do odkurzacza', cena: 15, ilosc: 3, suma: 45 }],
      addons_fee: 45,
    });
    const pozycja = rozpis.pozycje.find((p) => p.klucz === 'dodatek-worki-do-odkurzacza');
    expect(pozycja).toMatchObject({ etykieta: 'Worki do odkurzacza', kwota: 45 });
    expect(pozycja?.opis).toBe('3 × 15.00 zł');
  });

  it('pozycje składają się na sumę, więc nie ma korekty ręcznej', () => {
    const rozpis = rozpiszKoszty({
      ...podstawa,
      addons: [{ id: 'worek', nazwa: 'Worek', cena: 15, ilosc: 3, suma: 45 }],
      addons_fee: 45,
    });
    expect(rozpis.korektaReczna).toBeNull();
    expect(rozpis.suma).toBe(135);
  });

  it('rezerwacja bez dodatków wygląda jak dotąd', () => {
    const rozpis = rozpiszKoszty({ ...podstawa, total_price: 90 });
    expect(rozpis.pozycje).toHaveLength(1);
  });
});
