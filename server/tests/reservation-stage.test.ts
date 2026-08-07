import { describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';

const { describeRentalStage, warsawTimestamp, PENALTY_PER_STARTED_DAY } =
  await import('../src/reservation-stage.js');

/** 15.08.2026, godz. 09:00 czasu warszawskiego (lato = UTC+2). */
const ZWROT = warsawTimestamp('2026-08-15', '09:00');
const godzin = (n: number) => n * 60 * 60 * 1000;

const wynajem = (nadpisz: Record<string, unknown> = {}) => ({
  status: 'picked_up',
  payment_status: 'paid',
  contract_status: 'signed',
  start_date: '2026-08-10',
  start_time: '09:00',
  end_date: '2026-08-15',
  end_time: '09:00',
  is_indefinite: false,
  ...nadpisz,
});

describe('etap wynajmu przed wydaniem', () => {
  it('rezerwacja bez umowy to zapytanie czekajace na decyzje', () => {
    const info = describeRentalStage(wynajem({ status: 'pending', contract_status: 'not_prepared', payment_status: 'unpaid' }));
    expect(info.stage).toBe('inquiry');
  });

  it('po potwierdzeniu, ale przed przygotowaniem umowy', () => {
    const info = describeRentalStage(wynajem({ status: 'confirmed', contract_status: 'not_prepared', payment_status: 'unpaid' }));
    expect(info.stage).toBe('confirmed_no_contract');
  });

  it('umowa wystawiona i niepodpisana czeka na klienta', () => {
    const info = describeRentalStage(wynajem({ status: 'pending', contract_status: 'ready', payment_status: 'unpaid' }));
    expect(info.stage).toBe('awaiting_signature');
  });

  it('umowa podpisana bez platnosci to "do zaplaty"', () => {
    const info = describeRentalStage(wynajem({ status: 'pending', contract_status: 'signed', payment_status: 'unpaid' }));
    expect(info.stage).toBe('awaiting_payment');
  });

  it('podpisana i oplacona to "do wydania" z terminem wydania', () => {
    const info = describeRentalStage(wynajem({ status: 'pending', contract_status: 'signed', payment_status: 'paid' }));
    expect(info.stage).toBe('ready_for_pickup');
    expect(info.dueAt).toBe(new Date(warsawTimestamp('2026-08-10', '09:00')).toISOString());
  });

  it('reczny status "oczekuje" nie przykrywa faktu podpisu i zaplaty', () => {
    // To byl zglaszany blad: panel pokazywal "Oczekuje" obok "Oplacona" i "Umowa podpisana".
    const info = describeRentalStage(wynajem({ status: 'pending' }));
    expect(info.stage).toBe('ready_for_pickup');
  });
});

describe('etap wynajmu w trakcie i po terminie', () => {
  it('przed uplywem terminu sprzet jest u klienta', () => {
    const info = describeRentalStage(wynajem(), ZWROT - godzin(1));
    expect(info.stage).toBe('with_customer');
    expect(info.overdueDays).toBe(0);
    expect(info.suggestedPenalty).toBe(0);
  });

  it('dokladnie w godzinie zwrotu jeszcze nie ma opoznienia', () => {
    const info = describeRentalStage(wynajem(), ZWROT);
    expect(info.stage).toBe('with_customer');
  });

  it('minute po terminie liczy sie pierwsza rozpoczeta doba', () => {
    const info = describeRentalStage(wynajem(), ZWROT + 60_000);
    expect(info.stage).toBe('overdue');
    expect(info.overdueDays).toBe(1);
    expect(info.suggestedPenalty).toBe(PENALTY_PER_STARTED_DAY);
  });

  it('dwie i pol doby po terminie to trzy rozpoczete doby', () => {
    const info = describeRentalStage(wynajem(), ZWROT + godzin(60));
    expect(info.overdueDays).toBe(3);
    expect(info.suggestedPenalty).toBe(3 * PENALTY_PER_STARTED_DAY);
  });

  it('najem bezterminowy nigdy nie jest po terminie', () => {
    const info = describeRentalStage(
      wynajem({ is_indefinite: true, end_date: null }),
      ZWROT + godzin(24 * 365)
    );
    expect(info.stage).toBe('with_customer');
    expect(info.dueAt).toBeNull();
    expect(info.suggestedPenalty).toBe(0);
  });
});

describe('etapy koncowe maja pierwszenstwo', () => {
  it.each([
    ['cancelled', 'cancelled'],
    ['rejected', 'rejected'],
    ['completed', 'completed'],
    ['returned', 'return_in_progress'],
  ])('status %s daje etap %s niezaleznie od umowy i platnosci', (status, oczekiwany) => {
    const info = describeRentalStage(wynajem({ status, contract_status: 'signed', payment_status: 'paid' }));
    expect(info.stage).toBe(oczekiwany);
    expect(info.suggestedPenalty).toBe(0);
  });

  it('anulowana po terminie nie generuje kary', () => {
    const info = describeRentalStage(wynajem({ status: 'cancelled' }), ZWROT + godzin(240));
    expect(info.stage).toBe('cancelled');
    expect(info.overdueDays).toBe(0);
  });
});

describe('strefa czasowa wypozyczalni', () => {
  it('09:00 w Warszawie latem to 07:00 UTC', () => {
    expect(new Date(warsawTimestamp('2026-08-15', '09:00')).toISOString()).toBe('2026-08-15T07:00:00.000Z');
  });

  it('09:00 w Warszawie zima to 08:00 UTC', () => {
    expect(new Date(warsawTimestamp('2026-01-15', '09:00')).toISOString()).toBe('2026-01-15T08:00:00.000Z');
  });

  it('brak godziny domyslnie 09:00', () => {
    expect(warsawTimestamp('2026-08-15', null)).toBe(warsawTimestamp('2026-08-15', '09:00'));
  });

  it('data jako obiekt Date daje ten sam wynik co tekst', () => {
    expect(warsawTimestamp(new Date('2026-08-15T00:00:00.000Z'), '09:00'))
      .toBe(warsawTimestamp('2026-08-15', '09:00'));
  });

  it('godzina zwrotu 18:00 nie zapala opoznienia o poranku', () => {
    const info = describeRentalStage(
      wynajem({ end_time: '18:00' }),
      warsawTimestamp('2026-08-15', '17:59')
    );
    expect(info.stage).toBe('with_customer');
  });
});
