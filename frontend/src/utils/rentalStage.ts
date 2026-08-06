/**
 * Opis etapu wynajmu dla panelu. Sam etap wylicza serwer
 * (server/src/reservation-stage.ts) — tutaj tylko zamieniamy go na tekst i kolor.
 */

export type RentalStage =
  | 'inquiry'
  | 'confirmed_no_contract'
  | 'awaiting_signature'
  | 'awaiting_payment'
  | 'ready_for_pickup'
  | 'with_customer'
  | 'overdue'
  | 'return_in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface RentalStageInfo {
  stage: RentalStage;
  dueAt: string | null;
  overdueDays: number;
  suggestedPenalty: number;
}

export type StageTone = 'neutral' | 'info' | 'warning' | 'success' | 'error' | 'alert';

const OPIS: Record<RentalStage, { etykieta: string; ton: StageTone }> = {
  inquiry: { etykieta: 'Zapytanie — czeka na decyzję', ton: 'warning' },
  confirmed_no_contract: { etykieta: 'Potwierdzona — przygotuj umowę', ton: 'info' },
  awaiting_signature: { etykieta: 'Czeka na podpis klienta', ton: 'warning' },
  awaiting_payment: { etykieta: 'Do zapłaty', ton: 'warning' },
  ready_for_pickup: { etykieta: 'Do wydania', ton: 'success' },
  with_customer: { etykieta: 'U klienta', ton: 'info' },
  overdue: { etykieta: 'Po terminie', ton: 'alert' },
  return_in_progress: { etykieta: 'Zwrot — dokończ rozliczenie', ton: 'warning' },
  completed: { etykieta: 'Zakończona', ton: 'neutral' },
  rejected: { etykieta: 'Odrzucona', ton: 'error' },
  cancelled: { etykieta: 'Anulowana', ton: 'error' },
};

const dataIGodzina = (iso: string) => {
  const data = new Date(iso);
  const dzien = data.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
  const godzina = data.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  return `${dzien} godz. ${godzina}`;
};

const doby = (liczba: number) => {
  if (liczba === 1) return '1 doba';
  const reszta = liczba % 10;
  const dziesiatki = liczba % 100;
  const mnoga = reszta >= 2 && reszta <= 4 && (dziesiatki < 12 || dziesiatki > 14);
  return `${liczba} ${mnoga ? 'doby' : 'dób'}`;
};

export interface StageBadge {
  etykieta: string;
  ton: StageTone;
  /** Druga linia: termin albo skala opóźnienia. */
  szczegol: string | null;
}

export function opiszEtap(info: RentalStageInfo | undefined | null): StageBadge {
  if (!info) return { etykieta: 'Brak danych', ton: 'neutral', szczegol: null };
  const { etykieta, ton } = OPIS[info.stage] ?? OPIS.inquiry;

  if (info.stage === 'overdue') {
    return {
      etykieta,
      ton,
      szczegol: `${doby(info.overdueDays)} po terminie · kara do naliczenia ${info.suggestedPenalty} zł`,
    };
  }
  if ((info.stage === 'ready_for_pickup' || info.stage === 'awaiting_payment') && info.dueAt) {
    return { etykieta, ton, szczegol: `wydanie ${dataIGodzina(info.dueAt)}` };
  }
  if (info.stage === 'with_customer' && info.dueAt) {
    return { etykieta, ton, szczegol: `zwrot ${dataIGodzina(info.dueAt)}` };
  }
  if (info.stage === 'with_customer') {
    return { etykieta, ton, szczegol: 'najem bezterminowy' };
  }
  return { etykieta, ton, szczegol: null };
}

/**
 * Filtry listy rezerwacji. Celowo oparte na tych samych etapach co plakietki —
 * wcześniej filtry mówiły surowym statusem ("Oczekuje"), a plakietka obok
 * etapem ("Do zapłaty"), więc jeden ekran mówił dwoma językami.
 */
export type KluczFiltru =
  | 'aktywne'
  | 'wymaga_dzialania'
  | 'do_wydania'
  | 'u_klienta'
  | 'po_terminie'
  | 'zwroty'
  | 'zakonczone'
  | 'odrzucone'
  | 'wszystkie';

/**
 * Każdy etap ma dokładnie jedną grupę. Zapis jako Record wymusza to na
 * kompilatorze: nowy etap na serwerze nie przejdzie budowania, dopóki ktoś nie
 * zdecyduje, w którym filtrze ma się pokazywać. Inaczej najem zniknąłby z listy.
 */
const GRUPA: Record<RentalStage, Exclude<KluczFiltru, 'aktywne' | 'wszystkie'>> = {
  inquiry: 'wymaga_dzialania',
  confirmed_no_contract: 'wymaga_dzialania',
  awaiting_signature: 'wymaga_dzialania',
  awaiting_payment: 'wymaga_dzialania',
  ready_for_pickup: 'do_wydania',
  with_customer: 'u_klienta',
  overdue: 'po_terminie',
  return_in_progress: 'zwroty',
  completed: 'zakonczone',
  rejected: 'odrzucone',
  cancelled: 'odrzucone',
};

const ZAMKNIETE: RentalStage[] = ['completed', 'rejected', 'cancelled'];

export const FILTRY: { klucz: KluczFiltru; etykieta: string }[] = [
  { klucz: 'aktywne', etykieta: 'Aktywne' },
  { klucz: 'wymaga_dzialania', etykieta: 'Wymaga działania' },
  { klucz: 'do_wydania', etykieta: 'Do wydania' },
  { klucz: 'u_klienta', etykieta: 'U klienta' },
  { klucz: 'po_terminie', etykieta: 'Po terminie' },
  { klucz: 'zwroty', etykieta: 'Zwroty' },
  { klucz: 'zakonczone', etykieta: 'Zakończone' },
  { klucz: 'odrzucone', etykieta: 'Odrzucone' },
  { klucz: 'wszystkie', etykieta: 'Wszystkie' },
];

export function pasujeDoFiltru(info: RentalStageInfo | undefined | null, klucz: KluczFiltru): boolean {
  if (klucz === 'wszystkie') return true;
  const etap = info?.stage;
  // Rezerwacja bez wyliczonego etapu nie może zniknąć z widoku - pokaż ją w domyślnym.
  if (!etap || !(etap in GRUPA)) return klucz === 'aktywne';
  if (klucz === 'aktywne') return !ZAMKNIETE.includes(etap);
  return GRUPA[etap] === klucz;
}
