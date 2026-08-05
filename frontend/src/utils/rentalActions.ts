/**
 * Akcje obsługi najmu w panelu. Listę dostępnych akcji wylicza serwer
 * (server/src/reservation-transitions.ts) — tu tylko wygląd i etykiety.
 */

export type RentalAction =
  | 'confirm'
  | 'reject'
  | 'cancel'
  | 'hand_over'
  | 'register_return'
  | 'complete';

export interface ActionAvailability {
  action: RentalAction;
  available: boolean;
  reason?: string;
}

/** Status, na który przechodzi rezerwacja po wykonaniu akcji. */
export const ACTION_TARGET_STATUS: Record<RentalAction, string> = {
  confirm: 'confirmed',
  reject: 'rejected',
  cancel: 'cancelled',
  hand_over: 'picked_up',
  register_return: 'returned',
  complete: 'completed',
};
