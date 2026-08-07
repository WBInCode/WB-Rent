/**
 * Rozpis kosztów i opis terminu — te same dane trafiają do maila, panelu,
 * umowy i strefy klienta, więc rozjazd tutaj rozjeżdża wszystko naraz.
 */
import { describe, it, expect } from 'vitest';
import { rozpiszKoszty, rozpisJakoLinie, zloty } from '../src/costs.js';
import { opiszTermin, opiszMiejsca, ADRES_FIRMY } from '../src/rental-details.js';

const bazowa = {
  days: 2,
  base_price: 90,
  delivery_fee: 0,
  weekend_fee: 0,
  total_price: 90,
};

describe('rozpiszKoszty', () => {
  it('pokazuje sam najem, gdy nie ma dopłat', () => {
    const r = rozpiszKoszty(bazowa);
    expect(r.pozycje).toHaveLength(1);
    expect(r.pozycje[0].etykieta).toBe('Najem sprzętu (2 doby)');
    expect(r.suma).toBe(90);
    expect(r.korektaReczna).toBeNull();
  });

  it('nazywa dopłatę weekendową zamiast doliczać ją po cichu', () => {
    const r = rozpiszKoszty({ ...bazowa, weekend_fee: 30, total_price: 120 });
    const weekend = r.pozycje.find((p) => p.klucz === 'weekend');
    expect(weekend?.kwota).toBe(30);
    expect(weekend?.opis).toContain('sobotę');
    expect(r.pozycje.reduce((s, p) => s + p.kwota, 0)).toBe(r.suma);
  });

  it('pokazuje rabat jako pozycję ujemną wraz z kodem', () => {
    const r = rozpiszKoszty({
      ...bazowa,
      discount_amount: 20,
      discount_label: 'Rabat wakacyjny',
      discount_code: 'LATO20',
      total_price: 70,
    });
    const rabat = r.pozycje.find((p) => p.klucz === 'rabat');
    expect(rabat?.kwota).toBe(-20);
    expect(rabat?.opis).toContain('LATO20');
    expect(r.pozycje.reduce((s, p) => s + p.kwota, 0)).toBe(70);
  });

  it('suma pozycji zgadza się z kwotą do zapłaty przy komplecie dopłat', () => {
    const r = rozpiszKoszty({
      ...bazowa,
      delivery_fee: 40,
      weekend_fee: 30,
      discount_amount: 10,
      total_price: 150,
    });
    expect(r.pozycje.reduce((s, p) => s + p.kwota, 0)).toBe(r.suma);
    expect(r.korektaReczna).toBeNull();
  });

  it('ujawnia ręczną korektę ceny zamiast ukrywać różnicę', () => {
    const r = rozpiszKoszty({
      ...bazowa,
      total_price: 60,
      price_override_note: 'Stały klient',
    });
    expect(r.korektaReczna).toEqual({ kwota: -30, powod: 'Stały klient' });
    const zKorekta = r.pozycje.reduce((s, p) => s + p.kwota, 0) + r.korektaReczna!.kwota;
    expect(zKorekta).toBe(r.suma);
  });

  it('nazywa korektę nawet bez notatki pracownika', () => {
    const r = rozpiszKoszty({ ...bazowa, total_price: 120 });
    expect(r.korektaReczna?.powod).toBe('Indywidualne ustalenie ceny');
  });

  it('odmienia dobę zgodnie z liczbą dni', () => {
    const dla = (dni: number) => rozpiszKoszty({ ...bazowa, days: dni }).pozycje[0].etykieta;
    expect(dla(1)).toContain('1 doba');
    expect(dla(3)).toContain('3 doby');
    expect(dla(7)).toContain('7 dób');
  });

  it('zamienia rozpis na linie gotowe do umowy i wersji tekstowej', () => {
    const linie = rozpisJakoLinie(rozpiszKoszty({ ...bazowa, weekend_fee: 30, total_price: 120 }));
    expect(linie).toHaveLength(2);
    expect(linie[1].etykieta).toContain('Obsługa w weekend');
    expect(linie[1].kwota).toBe('30,00 zł');
  });

  it('formatuje kwoty po polsku', () => {
    expect(zloty(1234.5)).toBe('1234,50 zł');
    expect(zloty(-20)).toBe('-20,00 zł');
  });
});

describe('opiszTermin', () => {
  it('podaje dzień tygodnia, datę słownie i godzinę', () => {
    const t = opiszTermin('2026-08-08', '09:00');
    expect(t?.dzienTygodnia).toBe('sobota');
    expect(t?.dataSlownie).toBe('8 sierpnia 2026');
    expect(t?.godzina).toBe('09:00');
    expect(t?.pelny).toBe('sobota, 8 sierpnia 2026, godz. 09:00');
    expect(t?.weekend).toBe(true);
  });

  it('rozpoznaje dzień roboczy', () => {
    expect(opiszTermin('2026-08-12', '14:30')?.weekend).toBe(false);
    expect(opiszTermin('2026-08-12')?.dzienTygodnia).toBe('środa');
  });

  it('zwraca null dla braku daty', () => {
    expect(opiszTermin(null)).toBeNull();
    expect(opiszTermin('')).toBeNull();
  });
});

describe('opiszMiejsca', () => {
  it('przy odbiorze osobistym podaje adres punktu', () => {
    const m = opiszMiejsca({ delivery: 0, city: 'Rzeszów' });
    expect(m.odbior.adres).toBe(ADRES_FIRMY);
    expect(m.zwrot.adres).toBe(ADRES_FIRMY);
    expect(m.odbior.uKlienta).toBe(false);
  });

  it('przy dowozie podaje adres klienta dla odbioru i zwrotu', () => {
    const m = opiszMiejsca({ delivery: 1, address: 'ul. Cicha 3', city: 'Łańcut' });
    expect(m.odbior.adres).toBe('ul. Cicha 3, Łańcut');
    expect(m.zwrot.adres).toBe('ul. Cicha 3, Łańcut');
    expect(m.odbior.uKlienta).toBe(true);
  });

  it('nie dubluje miasta, gdy jest już w adresie', () => {
    const m = opiszMiejsca({ delivery: 1, address: 'ul. Cicha 3, 35-001 Rzeszów', city: 'Rzeszów' });
    expect(m.odbior.adres).toBe('ul. Cicha 3, 35-001 Rzeszów');
  });

  it('wraca do adresu punktu, gdy dowóz wybrano bez podania adresu', () => {
    const m = opiszMiejsca({ delivery: 1, address: '', city: 'Nie podano' });
    expect(m.odbior.adres).toBe(ADRES_FIRMY);
  });
});
