/**
 * Dozwolone przejścia statusu najmu i akcje możliwe w danym momencie.
 *
 * Panel nie decyduje, co wolno kliknąć — pyta o to serwer i rysuje dokładnie te
 * przyciski, które serwer i tak zaakceptuje. Dzięki temu front nie może wymusić
 * przejścia, którego backend nie przewiduje, ani odwrotnie.
 */
import { describeRentalStage, type RentalStage, type RentalStageInput } from './reservation-stage.js';

export type RentalAction =
  | 'confirm'
  | 'reject'
  | 'cancel'
  | 'hand_over'
  | 'register_return'
  | 'complete';

/** Status docelowy każdej akcji. */
export const ACTION_TARGET_STATUS: Record<RentalAction, string> = {
  confirm: 'confirmed',
  reject: 'rejected',
  cancel: 'cancelled',
  hand_over: 'picked_up',
  register_return: 'returned',
  complete: 'completed',
};

/** Z jakich statusów wolno wejść w dany status. Puste = stan końcowy. */
const ALLOWED_FROM: Record<string, string[]> = {
  confirmed: ['pending'],
  picked_up: ['confirmed'],
  returned: ['picked_up'],
  completed: ['returned'],
  rejected: ['pending', 'confirmed'],
  cancelled: ['pending', 'confirmed'],
  pending: [],
};

export interface ActionAvailability {
  action: RentalAction;
  available: boolean;
  /** Wypełniony tylko gdy akcja jest zablokowana — panel pokazuje to jako powód. */
  reason?: string;
}

export interface TransitionContext {
  /** Zdjęcia sprzętu po najmie — warunek zamknięcia najmu. */
  returnPhotos: number;
  /** Zdjęcia sprzętu przy wydaniu — warunek wydania. */
  handoverPhotos?: number;
  /** Czy protokół wydania został podpisany przez obie Strony. */
  handoverProtocolSigned?: boolean;
  /** Czy protokół zwrotu został podpisany przez obie Strony. */
  returnProtocolSigned?: boolean;
}

/** Czy można teraz przystąpić do zwrotu: przygotować i podpisać protokół zwrotu. */
export function canPrepareReturn(
  reservation: RentalStageInput,
  now: number = Date.now()
): TransitionCheck {
  const { stage } = describeRentalStage(reservation, now);
  if (stage === 'with_customer' || stage === 'overdue') return { ok: true };
  return { ok: false, reason: 'Zwrot można przyjąć dopiero po wydaniu sprzętu' };
}

/**
 * Czy można teraz przystąpić do wydania: przygotować i podpisać protokół. To co
 * innego niż samo wydanie — wydanie wymaga dodatkowo podpisanego protokołu
 * i zdjęć, więc bez tego rozróżnienia warunek byłby sam dla siebie przeszkodą.
 */
export function canPrepareHandover(
  reservation: RentalStageInput,
  now: number = Date.now()
): TransitionCheck {
  const { stage } = describeRentalStage(reservation, now);
  if (stage === 'confirmed_no_contract') return { ok: false, reason: 'Najpierw przygotuj umowę najmu' };
  if (stage === 'awaiting_signature') return { ok: false, reason: 'Klient nie podpisał jeszcze umowy' };
  if (stage === 'awaiting_payment') return { ok: false, reason: 'Rezerwacja nie została opłacona' };
  if (stage !== 'ready_for_pickup') return { ok: false, reason: 'Wydanie nie jest teraz możliwe' };
  return { ok: true };
}

/** Etapy, z których rezerwację można jeszcze odrzucić lub anulować. */
const CANCELLABLE: RentalStage[] = [
  'inquiry',
  'confirmed_no_contract',
  'awaiting_signature',
  'awaiting_payment',
  'ready_for_pickup',
];

export function availableActions(
  reservation: RentalStageInput,
  context: TransitionContext,
  now: number = Date.now()
): ActionAvailability[] {
  const { stage } = describeRentalStage(reservation, now);
  const kandydaci: ActionAvailability[] = [];

  const add = (action: RentalAction, available: boolean, reason?: string) =>
    kandydaci.push(available ? { action, available } : { action, available, reason });

  if (stage === 'inquiry') {
    add('confirm', true);
  }

  if (stage === 'confirmed_no_contract') {
    add('hand_over', false, 'Najpierw przygotuj umowę najmu');
  }
  if (stage === 'awaiting_signature') {
    add('hand_over', false, 'Klient nie podpisał jeszcze umowy');
  }
  if (stage === 'awaiting_payment') {
    add('hand_over', false, 'Rezerwacja nie została opłacona');
  }
  if (stage === 'ready_for_pickup') {
    // Wydanie zamyka trzy rzeczy naraz: podpisany protokół, zdjęcia stanu i zmianę
    // statusu. Bez któregokolwiek z nich sprzęt nie może opuścić wypożyczalni.
    if (!context.handoverProtocolSigned) {
      add('hand_over', false, 'Podpiszcie protokół wydania');
    } else if ((context.handoverPhotos ?? 0) === 0) {
      add('hand_over', false, 'Dodaj zdjęcia wydawanego sprzętu');
    } else {
      add('hand_over', true);
    }
  }

  if (stage === 'with_customer' || stage === 'overdue') {
    // Zwrot, tak jak wydanie, potwierdza podpisany dokument i zdjęcia stanu.
    if (!context.returnProtocolSigned) {
      add('register_return', false, 'Podpiszcie protokół zwrotu');
    } else if (context.returnPhotos === 0) {
      add('register_return', false, 'Dodaj zdjęcia sprzętu po zwrocie');
    } else {
      add('register_return', true);
    }
  }

  if (stage === 'return_in_progress') {
    add('complete', true);
  }

  if (CANCELLABLE.includes(stage)) {
    add('cancel', true);
    add('reject', true);
  }

  // Ostatnie sito: kolejność statusów. Bez tego panel mógłby narysować przycisk,
  // który API i tak odrzuci — a to dokładnie ten rodzaj rozjazdu front/backend,
  // którego nie wolno tu mieć.
  return kandydaci.filter((item) =>
    (ALLOWED_FROM[ACTION_TARGET_STATUS[item.action]] ?? []).includes(reservation.status)
  );
}

export interface TransitionCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Ostateczna bramka przed zapisem. Sprawdza i kolejność statusów, i warunki
 * biznesowe — nawet gdyby ktoś ominął panel i uderzył prosto w API.
 */
export function canTransition(
  reservation: RentalStageInput & { status: string },
  targetStatus: string,
  context: TransitionContext,
  now: number = Date.now()
): TransitionCheck {
  if (reservation.status === targetStatus) {
    return { ok: false, reason: 'Rezerwacja ma już ten status' };
  }

  const allowedFrom = ALLOWED_FROM[targetStatus];
  if (!allowedFrom) {
    return { ok: false, reason: `Nieznany status: ${targetStatus}` };
  }
  if (!allowedFrom.includes(reservation.status)) {
    return {
      ok: false,
      reason: `Nie można przejść z „${STATUS_PL[reservation.status] ?? reservation.status}” do „${STATUS_PL[targetStatus] ?? targetStatus}”`,
    };
  }

  const action = (Object.keys(ACTION_TARGET_STATUS) as RentalAction[])
    .find((key) => ACTION_TARGET_STATUS[key] === targetStatus);
  if (!action) return { ok: true };

  const availability = availableActions(reservation, context, now).find((item) => item.action === action);
  if (!availability) {
    return { ok: false, reason: 'Ta operacja nie jest teraz możliwa' };
  }
  if (!availability.available) {
    return { ok: false, reason: availability.reason };
  }
  return { ok: true };
}

const STATUS_PL: Record<string, string> = {
  pending: 'Oczekuje',
  confirmed: 'Potwierdzona',
  picked_up: 'Wydane',
  returned: 'Zwrócone',
  completed: 'Zakończona',
  rejected: 'Odrzucona',
  cancelled: 'Anulowana',
};
