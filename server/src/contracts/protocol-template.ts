/**
 * Tresc protokolu wydania (Zalacznik nr 1). Protokol jest osobnym dokumentem od
 * umowy: umowe klient moze podpisac zdalnie, a odbior sprzetu potwierdza dopiero
 * przy jego fizycznym wydaniu. Wczesniej oba podpisy zbierano naraz, wiec klient
 * potwierdzal odbior urzadzenia, ktorego jeszcze nie widzial.
 */

export const PROTOCOL_TEMPLATE_VERSION = '1.0.0';

export interface ProtocolParty {
  name: string;
  address?: string;
  nip?: string;
  representative?: string;
  email?: string;
  phone?: string;
}

export interface HandoverSnapshot {
  version: string;
  kind: 'handover';
  protocolNumber: string;
  contractNumber: string | null;
  createdAt: string;
  lessor: ProtocolParty;
  renter: ProtocolParty;
  rental: {
    reservationId: number;
    startDate: string;
    startTime: string;
    endDate: string | null;
    endTime: string;
    isIndefinite: boolean;
    days: number;
  };
  /** Miejsce wydania - siedziba albo adres dostawy. */
  place: string;
  /** Co dokladnie wydano: urzadzenia i osprzet. */
  items: string[];
  accessories: string;
  /** Stan sprzetu w chwili wydania - wpisywany przez pracownika przy wydaniu. */
  conditionNotes: string;
  statements: string[];
  employeeName: string;
  photoCount: number;
  /** Dopóki pracownik nic nie zmienił, szkic nadąża za umową. */
  edited?: boolean;
}

const OSWIADCZENIA = (manuals: string): string[] => [
  'Najemca potwierdza odbiór Sprzętu wymienionego w niniejszym protokole wraz z osprzętem.',
  'Najemca oświadcza, że Sprzęt jest sprawny i kompletny, a jego stan odpowiada opisowi powyżej.',
  `Najemca potwierdza otrzymanie Załącznika nr 3 – ${manuals} oraz odbycie krótkiego szkolenia z obsługi Sprzętu.`,
  'Najemca zobowiązuje się używać Sprzętu zgodnie z instrukcją i przeznaczeniem oraz zwrócić go w stanie niepogorszonym ponad normalne zużycie.',
  'Zdjęcia stanu Sprzętu wykonane przy wydaniu stanowią załącznik do niniejszego protokołu i są przechowywane w dokumentacji najmu.',
  'Protokół sporządzono w formie elektronicznej; obie Strony otrzymują go na wskazane adresy e-mail.',
];

// Zdjęcia powstają przy fizycznym wydaniu, czyli już po podpisaniu protokołu,
// dlatego dokument nie podaje ich liczby - podawałby liczbę sprzed wydania.
export function buildHandoverStatements(manuals: string): string[] {
  return OSWIADCZENIA(manuals);
}

/** Miejsce wydania opisane tak, jak ma trafić do dokumentu. */
export function handoverPlace(delivery: boolean, deliveryAddress?: string | null): string {
  return delivery && deliveryAddress
    ? `dostawa pod adres: ${deliveryAddress}`
    : 'punkt Wynajmującego: Rzeszów, ul. J. Słowackiego 24/11';
}

// === PROTOKÓŁ ZWROTU (Załącznik nr 2) ===

/** Stawki z §12 umowy. Pracownik może je zmienić, ale zaczyna od cennika. */
export const CZYSZCZENIE_STANDARDOWE = 30;
export const CZYSZCZENIE_POGLEBIONE_MAX = 50;

export type RodzajNaleznosci = 'cleaning' | 'deep_cleaning' | 'damage' | 'missing' | 'penalty' | 'other';

export interface ReturnCharge {
  kind: RodzajNaleznosci;
  label: string;
  /** null = koszt znany dopiero po wycenie serwisu (§3a umowy). */
  amount: number | null;
  note?: string;
}

export interface ReturnChecklist {
  complete: boolean;
  working: boolean;
  clean: boolean;
  undamaged: boolean;
}

export interface ReturnSnapshot {
  version: string;
  kind: 'return';
  protocolNumber: string;
  contractNumber: string | null;
  handoverProtocolNumber: string | null;
  createdAt: string;
  lessor: ProtocolParty;
  renter: ProtocolParty;
  rental: {
    reservationId: number;
    startDate: string;
    startTime: string;
    endDate: string | null;
    endTime: string;
    isIndefinite: boolean;
    days: number;
  };
  place: string;
  /** Co zwrócono — lista z protokołu wydania, poprawialna przy zwrocie. */
  items: string[];
  checklist: ReturnChecklist;
  /** Stan przy wydaniu, przepisany z Załącznika nr 1 — punkt odniesienia. */
  conditionAtHandover: string;
  conditionNotes: string;
  charges: ReturnCharge[];
  /** Suma pozycji o znanej kwocie. */
  chargesTotal: number;
  /** Czy któraś pozycja czeka na wycenę serwisu. */
  hasPendingValuation: boolean;
  deposit: number;
  /** Ile Najemca dopłaca (dodatnie) albo ile kaucji wraca (ujemne). */
  balance: number;
  overdueDays: number;
  statements: string[];
  employeeName: string;
  edited?: boolean;
}

export const POZYCJE_LISTY: { klucz: keyof ReturnChecklist; etykieta: string }[] = [
  { klucz: 'complete', etykieta: 'Kompletny' },
  { klucz: 'working', etykieta: 'Sprawny' },
  { klucz: 'clean', etykieta: 'Czysty' },
  { klucz: 'undamaged', etykieta: 'Bez uszkodzeń' },
];

const OSWIADCZENIA_ZWROTU = (zastrzezenia: boolean, wycena: boolean): string[] => [
  zastrzezenia
    ? 'Strony zgodnie stwierdzają, że Sprzęt zwrócono z zastrzeżeniami opisanymi powyżej.'
    : 'Strony zgodnie stwierdzają, że Sprzęt zwrócono kompletny, sprawny, czysty i bez uszkodzeń.',
  'Zdjęcia stanu Sprzętu wykonane przy zwrocie stanowią załącznik do niniejszego protokołu i są przechowywane w dokumentacji najmu.',
  ...(wycena
    ? ['Pozycje oznaczone jako „do wyceny w serwisie” zostaną wskazane kwotowo po otrzymaniu faktury serwisowej; Najemca opłaca je w terminie 7 dni od jej doręczenia (§3a umowy).']
    : []),
  'Rozliczenie należności wskazane w niniejszym protokole następuje w pierwszej kolejności z kaucji, a różnicę Strony regulują zgodnie z umową.',
  'Protokół sporządzono w formie elektronicznej; obie Strony otrzymują go na wskazane adresy e-mail.',
];

export function buildReturnStatements(zastrzezenia: boolean, wycena: boolean): string[] {
  return OSWIADCZENIA_ZWROTU(zastrzezenia, wycena);
}

export function podsumujNaleznosci(charges: ReturnCharge[], deposit: number) {
  const chargesTotal = charges.reduce((suma, pozycja) => suma + (pozycja.amount ?? 0), 0);
  return {
    chargesTotal,
    hasPendingValuation: charges.some((pozycja) => pozycja.amount === null),
    balance: Math.round((chargesTotal - deposit) * 100) / 100,
  };
}
