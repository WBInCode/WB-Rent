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
