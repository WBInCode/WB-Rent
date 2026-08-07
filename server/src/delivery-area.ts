/**
 * Obszar dowozu i odbioru sprzętu.
 *
 * Wcześniej zasięg liczyło zewnętrzne API (Nominatim) z promienia 30 km od
 * Rzeszowa. To dawało trzy problemy naraz: wypożyczalnia jeździła poza obszar,
 * w którym realnie obsługuje klientów; rezerwacja zależała od dostępności
 * cudzego serwisu; a klient wpisywał nazwę miasta, którą można napisać na
 * dziesięć sposobów.
 *
 * Teraz decyduje kod pocztowy — jednoznaczny i sprawdzalny bez sieci.
 */

/** Rzeszów ma kody 35-xxx. Sąsiednie gminy zaczynają się od 36- i są poza obszarem. */
const PREFIKS_RZESZOWA = '35-';

export type OcenaAdresu =
  | { wObszarze: true; miasto: 'Rzeszów' }
  | { wObszarze: false; powod: string };

/** Zapis kodu w postaci „35-001" niezależnie od tego, jak klient go wpisał. */
export function znormalizujKod(kod: string | null | undefined): string {
  const cyfry = String(kod ?? '').replace(/\D/g, '').slice(0, 5);
  if (cyfry.length <= 2) return cyfry;
  return `${cyfry.slice(0, 2)}-${cyfry.slice(2)}`;
}

/**
 * Czy pod ten kod dowozimy sprzęt. Poza Rzeszowem najem jest nadal możliwy —
 * tylko z odbiorem osobistym, więc komunikat mówi, co klient może zrobić.
 */
export function ocenAdresDostawy(kod: string | null | undefined): OcenaAdresu {
  const surowe = String(kod ?? '').trim();
  if (!surowe) {
    return { wObszarze: false, powod: 'Podaj kod pocztowy adresu dostawy' };
  }

  // Liczba cyfr sprawdzana przed normalizacją — inaczej „350012" zostałoby
  // po cichu obcięte do „35-001" i przyjęte jako poprawne.
  const cyfry = surowe.replace(/\D/g, '');
  if (cyfry.length !== 5 || /[^\d\s-]/.test(surowe)) {
    return { wObszarze: false, powod: 'Kod pocztowy ma format 00-000' };
  }

  const znormalizowany = znormalizujKod(surowe);
  if (!znormalizowany.startsWith(PREFIKS_RZESZOWA)) {
    return {
      wObszarze: false,
      powod: 'Dowozimy wyłącznie na terenie Rzeszowa. Spod tego adresu sprzęt można odebrać osobiście w naszym punkcie.',
    };
  }
  return { wObszarze: true, miasto: 'Rzeszów' };
}
