/**
 * Termin i miejsca odbioru/zwrotu - jedno zrodlo prawdy.
 *
 * Wczesniej data pojawiala sie goła ("2026-08-10"), bez dnia tygodnia, a adres
 * odbioru i zwrotu nie byl podany nigdzie: przy dowozie klient nie widzial
 * swojego adresu, przy odbiorze osobistym nie widzial adresu firmy. Skutek:
 * z dokumentu nie dalo sie odczytac, gdzie i kiedy ma sie stawic.
 */

export const ADRES_FIRMY = 'ul. Juliusza Słowackiego 24/11, 35-060 Rzeszów';
export const NAZWA_FIRMY = 'WB Partners Sp. z o.o.';

const DNI_TYGODNIA = [
  'niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota',
] as const;

const MIESIACE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
] as const;

export type Termin = {
  /** Format zapisu, np. 2026-08-10. */
  data: string;
  /** Czytelnie, np. "10 sierpnia 2026". */
  dataSlownie: string;
  /** Nazwa dnia, np. "poniedziałek". */
  dzienTygodnia: string;
  godzina: string;
  /** Wszystko w jednej linii: "poniedziałek, 10 sierpnia 2026, godz. 09:00". */
  pelny: string;
  weekend: boolean;
};

/** Termin z dniem tygodnia i godzina - do maili, panelu i dokumentow. */
export function opiszTermin(data: string | null | undefined, godzina?: string | null): Termin | null {
  if (!data) return null;
  const iso = String(data).slice(0, 10);
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  const dzien = DNI_TYGODNIA[d.getDay()];
  const dataSlownie = `${d.getDate()} ${MIESIACE[d.getMonth()]} ${d.getFullYear()}`;
  const czas = (godzina || '').slice(0, 5);

  return {
    data: iso,
    dataSlownie,
    dzienTygodnia: dzien,
    godzina: czas,
    pelny: [`${dzien}, ${dataSlownie}`, czas ? `godz. ${czas}` : null].filter(Boolean).join(', '),
    weekend: d.getDay() === 0 || d.getDay() === 6,
  };
}

export type MiejsceWydania = {
  /** "Dowóz pod adres klienta" albo "Odbiór osobisty w punkcie". */
  tryb: string;
  adres: string;
  uKlienta: boolean;
};

/**
 * Miejsce odbioru i zwrotu. Gdy klient wybral dowoz - jego adres; gdy odbiera
 * sam - adres punktu. W obu przypadkach adres jest wypisany wprost, zeby nie
 * trzeba bylo go nigdzie doszukiwac.
 */
export function opiszMiejsca(rezerwacja: {
  delivery?: number | boolean | null;
  address?: string | null;
  city?: string | null;
}): { odbior: MiejsceWydania; zwrot: MiejsceWydania } {
  const dowoz = Boolean(Number(rezerwacja.delivery ?? 0));
  const adres = rezerwacja.address?.trim() || '';
  const miasto = rezerwacja.city?.trim() || '';
  // Klient zwykle wpisuje miasto w adresie - dopisanie go drugi raz dawalo
  // "ul. Cicha 3, 35-001 Rzeszów, Rzeszów".
  const adresKlienta = [adres, miasto && miasto !== 'Nie podano' && !adres.toLowerCase().includes(miasto.toLowerCase()) ? miasto : null]
    .filter(Boolean)
    .join(', ');

  if (dowoz && adresKlienta) {
    return {
      odbior: { tryb: 'Dowóz pod adres Najemcy', adres: adresKlienta, uKlienta: true },
      zwrot: { tryb: 'Odbiór sprzętu spod adresu Najemcy', adres: adresKlienta, uKlienta: true },
    };
  }

  const punkt: MiejsceWydania = {
    tryb: 'Odbiór osobisty w punkcie Wynajmującego',
    adres: ADRES_FIRMY,
    uKlienta: false,
  };
  return {
    odbior: punkt,
    zwrot: { ...punkt, tryb: 'Zwrot w punkcie Wynajmującego' },
  };
}
