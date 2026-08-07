/**
 * Jeden stan wynajmu wyliczany z danych, zamiast trzech niezależnych kolumn
 * (status / payment_status / contract_status), które panel pokazywał obok siebie.
 * Funkcja jest czysta - te same dane zawsze dają ten sam wynik.
 */

/** Kara umowna za rozpoczętą dobę bezumownego przetrzymania (§4 ust. 1 umowy). */
export const PENALTY_PER_STARTED_DAY = 200;

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
  /** Termin, który dotyczy tego etapu (wydanie albo zwrot). ISO z godziną. */
  dueAt: string | null;
  /** Rozpoczęte doby opóźnienia zwrotu; 0 gdy w terminie lub najem bezterminowy. */
  overdueDays: number;
  /**
   * Kara wyliczona wg §4 ust. 1. To PROPOZYCJA - naliczenie jest prawem
   * Wynajmującego, nie obowiązkiem, więc decyzję podejmuje pracownik.
   */
  suggestedPenalty: number;
}

export interface RentalStageInput {
  status: string;
  payment_status?: string | null;
  contract_status?: string | null;
  start_date: string | Date;
  start_time?: string | null;
  end_date?: string | Date | null;
  end_time?: string | null;
  is_indefinite?: boolean | null;
}

const isoDate = (value: string | Date): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

/** Przesunięcie strefy Europe/Warsaw w minutach dla danej chwili (uwzględnia czas letni). */
const warsawOffsetMinutes = (utcMs: number): number => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return (asUtc - utcMs) / 60_000;
};

/**
 * Data i godzina najmu są zapisane w czasie lokalnym wypożyczalni. Serwer w Dockerze
 * chodzi w UTC, więc bez jawnego przeliczenia "po terminie" zapalałoby się o 2 godziny
 * za wcześnie latem.
 */
export const warsawTimestamp = (date: string | Date, time: string | null | undefined): number => {
  const [year, month, day] = isoDate(date).split('-').map(Number);
  const [hour, minute] = String(time || '09:00').split(':').map(Number);
  const naive = Date.UTC(year, month - 1, day, hour || 0, minute || 0);
  return naive - warsawOffsetMinutes(naive) * 60_000;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function describeRentalStage(
  reservation: RentalStageInput,
  now: number = Date.now()
): RentalStageInfo {
  const pickupAt = new Date(warsawTimestamp(reservation.start_date, reservation.start_time)).toISOString();
  const hasReturnDate = !reservation.is_indefinite && Boolean(reservation.end_date);
  const returnAt = hasReturnDate
    ? new Date(warsawTimestamp(reservation.end_date as string | Date, reservation.end_time)).toISOString()
    : null;

  const base = { dueAt: null as string | null, overdueDays: 0, suggestedPenalty: 0 };

  if (reservation.status === 'cancelled') return { ...base, stage: 'cancelled' };
  if (reservation.status === 'rejected') return { ...base, stage: 'rejected' };
  if (reservation.status === 'completed') return { ...base, stage: 'completed' };
  if (reservation.status === 'returned') return { ...base, stage: 'return_in_progress' };

  if (reservation.status === 'picked_up') {
    const deadline = returnAt ? Date.parse(returnAt) : null;
    if (deadline !== null && now > deadline) {
      const overdueDays = Math.ceil((now - deadline) / DAY_MS);
      return {
        stage: 'overdue',
        dueAt: returnAt,
        overdueDays,
        suggestedPenalty: overdueDays * PENALTY_PER_STARTED_DAY,
      };
    }
    return { ...base, stage: 'with_customer', dueAt: returnAt };
  }

  // Przed wydaniem: o etapie decyduje umowa i płatność, nie ręczny status.
  const contract = reservation.contract_status || 'not_prepared';
  const paid = reservation.payment_status === 'paid';

  if (contract === 'signed') {
    return paid
      ? { ...base, stage: 'ready_for_pickup', dueAt: pickupAt }
      : { ...base, stage: 'awaiting_payment', dueAt: pickupAt };
  }
  if (contract === 'ready') {
    return { ...base, stage: 'awaiting_signature', dueAt: pickupAt };
  }
  return {
    ...base,
    stage: reservation.status === 'confirmed' ? 'confirmed_no_contract' : 'inquiry',
    dueAt: pickupAt,
  };
}
