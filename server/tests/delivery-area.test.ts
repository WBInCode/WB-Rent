/**
 * Obszar dowozu i naliczanie kursów.
 *
 * Wcześniej zasięg liczyło zewnętrzne API z promienia 30 km, a dowóz był jedną
 * zryczałtowaną opłatą — nie dało się zamówić samego przywiezienia.
 */
import { describe, it, expect } from 'vitest';
import { ocenAdresDostawy, znormalizujKod } from '../src/delivery-area.js';
import { opiszMiejsca, ADRES_FIRMY } from '../src/rental-details.js';
import { rozpiszKoszty } from '../src/costs.js';

describe('obszar dowozu', () => {
  it('dowozi pod kody rzeszowskie', () => {
    for (const kod of ['35-001', '35-060', '35-959']) {
      expect(ocenAdresDostawy(kod).wObszarze).toBe(true);
    }
  });

  it('nie dowozi poza Rzeszów i mówi, co klient może zrobić', () => {
    const ocena = ocenAdresDostawy('36-040');
    expect(ocena.wObszarze).toBe(false);
    if (!ocena.wObszarze) expect(ocena.powod).toMatch(/odebra\u0107 osobi\u015bcie/);
  });

  it('odrzuca kod w złym formacie', () => {
    for (const kod of ['35', '350012', 'abc']) {
      expect(ocenAdresDostawy(kod).wObszarze).toBe(false);
    }
  });

  it('prosi o kod, gdy go nie ma', () => {
    const ocena = ocenAdresDostawy('');
    expect(ocena.wObszarze).toBe(false);
    if (!ocena.wObszarze) expect(ocena.powod).toMatch(/Podaj kod/);
  });

  it('przyjmuje kod zapisany bez myślnika i ze spacjami', () => {
    expect(znormalizujKod('35001')).toBe('35-001');
    expect(znormalizujKod(' 35 001 ')).toBe('35-001');
    expect(ocenAdresDostawy('35001').wObszarze).toBe(true);
  });
});

describe('miejsca odbioru i zwrotu przy dwóch kursach', () => {
  const adres = { address: 'ul. Cicha 3', city: 'Rzeszów', postal_code: '35-001' };

  it('oba kursy — sprzęt jedzie tam i wraca spod adresu klienta', () => {
    const m = opiszMiejsca({ ...adres, delivery_out: 1, delivery_back: 1 });
    expect(m.odbior.uKlienta).toBe(true);
    expect(m.zwrot.uKlienta).toBe(true);
  });

  it('sam dowóz — klient oddaje sprzęt w punkcie', () => {
    const m = opiszMiejsca({ ...adres, delivery_out: 1, delivery_back: 0 });
    expect(m.odbior.uKlienta).toBe(true);
    expect(m.zwrot.adres).toBe(ADRES_FIRMY);
  });

  it('sam odbiór — klient przyjeżdża po sprzęt, my go odbieramy', () => {
    const m = opiszMiejsca({ ...adres, delivery_out: 0, delivery_back: 1 });
    expect(m.odbior.adres).toBe(ADRES_FIRMY);
    expect(m.zwrot.uKlienta).toBe(true);
  });

  it('bez kursów oba miejsca to punkt wynajmującego', () => {
    const m = opiszMiejsca({ ...adres, delivery_out: 0, delivery_back: 0 });
    expect(m.odbior.adres).toBe(ADRES_FIRMY);
    expect(m.zwrot.adres).toBe(ADRES_FIRMY);
  });

  it('dopisuje kod pocztowy do adresu, ale nie dubluje go', () => {
    expect(opiszMiejsca({ address: 'ul. Cicha 3', city: 'Rzeszów', postal_code: '35-001', delivery_out: 1 }).odbior.adres)
      .toBe('ul. Cicha 3, 35-001 Rzeszów');
    expect(opiszMiejsca({ address: 'ul. Cicha 3, 35-001 Rzeszów', city: 'Rzeszów', postal_code: '35-001', delivery_out: 1 }).odbior.adres)
      .toBe('ul. Cicha 3, 35-001 Rzeszów');
  });
});

describe('rozpis kosztów nazywa kursy po imieniu', () => {
  const podstawa = { days: 2, base_price: 90, weekend_fee: 0 };

  it('sam dowóz kosztuje jeden kurs', () => {
    const r = rozpiszKoszty({ ...podstawa, delivery_fee: 20, total_price: 110, delivery_out: 1, delivery_back: 0 });
    const dostawa = r.pozycje.find((p) => p.klucz === 'dostawa');
    expect(dostawa?.etykieta).toBe('Dowóz sprzętu');
    expect(dostawa?.kwota).toBe(20);
  });

  it('sam odbiór też jeden kurs', () => {
    const r = rozpiszKoszty({ ...podstawa, delivery_fee: 20, total_price: 110, delivery_out: 0, delivery_back: 1 });
    expect(r.pozycje.find((p) => p.klucz === 'dostawa')?.etykieta).toBe('Odbiór sprzętu');
  });

  it('oba kursy to dwie opłaty', () => {
    const r = rozpiszKoszty({ ...podstawa, delivery_fee: 40, total_price: 130, delivery_out: 1, delivery_back: 1 });
    const dostawa = r.pozycje.find((p) => p.klucz === 'dostawa');
    expect(dostawa?.etykieta).toBe('Dowóz i odbiór sprzętu');
    expect(dostawa?.kwota).toBe(40);
  });

  it('opłata weekendowa mówi, za które zdarzenie jest naliczona', () => {
    const r = rozpiszKoszty({
      days: 2, base_price: 90, delivery_fee: 0, weekend_fee: 60, total_price: 150,
      start_date: '2026-08-08', end_date: '2026-08-09',
    });
    const weekend = r.pozycje.find((p) => p.klucz === 'weekend');
    expect(weekend?.kwota).toBe(60);
    expect(weekend?.opis).toContain('wydanie i zwrot');
  });

  it('weekendowe tylko wydanie — opis wskazuje jedno zdarzenie', () => {
    const r = rozpiszKoszty({
      days: 3, base_price: 120, delivery_fee: 0, weekend_fee: 30, total_price: 150,
      start_date: '2026-08-08', end_date: '2026-08-11',
    });
    expect(r.pozycje.find((p) => p.klucz === 'weekend')?.opis).toContain('wydanie w sobotę');
  });
});
