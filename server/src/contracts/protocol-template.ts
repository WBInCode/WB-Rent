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
  'Protokół sporządzono w formie elektronicznej; obie Strony otrzymują go na wskazane adresy e-mail.',
];

/** Dopisywane tylko wtedy, gdy zdjęcia naprawdę istnieją — inaczej protokół powoływałby się na nieistniejący dowód. */
export const OSWIADCZENIE_O_ZDJECIACH =
  'Zdjęcia stanu Sprzętu wykonane przy wydaniu stanowią integralną część niniejszego protokołu.';

export function buildHandoverStatements(manuals: string, photoCount = 0): string[] {
  const lista = OSWIADCZENIA(manuals);
  if (photoCount === 0) return lista;
  return [...lista.slice(0, -1), OSWIADCZENIE_O_ZDJECIACH, lista[lista.length - 1]];
}

/** Miejsce wydania opisane tak, jak ma trafić do dokumentu. */
export function handoverPlace(delivery: boolean, deliveryAddress?: string | null): string {
  return delivery && deliveryAddress
    ? `dostawa pod adres: ${deliveryAddress}`
    : 'punkt Wynajmującego: Rzeszów, ul. J. Słowackiego 24/11';
}
