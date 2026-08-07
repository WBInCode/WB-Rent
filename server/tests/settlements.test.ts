/**
 * Dopłata rozliczeniowa to inna należność niż czynsz najmu.
 *
 * Zanim je rozdzielono, mail po zwrocie obiecywał zapłatę salda, a bramka
 * żądała pełnej kwoty najmu — i każda dopłata nadpisywała payment_status
 * rezerwacji.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.NODE_ENV = 'test';

const zapisane: any[] = [];
const stanPlatnosci: Record<string, any> = {};

vi.mock('../src/db.js', () => ({
  queries: {
    getReservationById: async (id: number) =>
      id === 999 ? null : { id, product_id: 'puzzi-10-1', email: 'k@example.com', total_price: 190, status: 'returned', payment_status: 'unpaid' },
    getLatestPaymentForReservation: async (_id: number, kind: string) => stanPlatnosci[kind],
    getSettlementByLabel: async (_id: number, label: string) => stanPlatnosci[`settlement:${label}`],
    cancelPendingPayments: async (_id: number, kind: string, label?: string) => {
      if (label) delete stanPlatnosci[`settlement:${label}`];
      else delete stanPlatnosci[kind];
      return [];
    },
    insertPayment: async (dane: any) => { zapisane.push(dane); return { lastInsertRowid: zapisane.length }; },
    hasSignedContract: async () => true,
  },
}));

vi.mock('../src/payments/index.js', () => ({
  getActiveProvider: () => ({
    name: 'testowy',
    createPayment: async (input: any) => ({
      redirectUrl: `https://bramka.test/${input.sessionId}?kwota=${input.amount}`,
      externalId: `ext-${input.sessionId}`,
    }),
  }),
  getProviderByName: () => null,
}));

const { resolveSettlementLink, resolvePaymentLink } = await import('../src/payments/routes.js');

beforeEach(() => {
  zapisane.length = 0;
  for (const k of Object.keys(stanPlatnosci)) delete stanPlatnosci[k];
});

describe('dopłata rozliczeniowa', () => {
  it('opiewa na podaną kwotę, nie na czynsz najmu', async () => {
    const link = await resolveSettlementLink(1, 150, 'Naprawa turbiny', '127.0.0.1');
    expect(link.status).toBe('ready');
    if (link.status !== 'ready') return;
    expect(link.amount).toBe(150);
    expect(link.url).toContain('kwota=150');
  });

  it('czynsz najmu nadal idzie na total_price', async () => {
    const link = await resolvePaymentLink(1, '127.0.0.1');
    expect(link.status).toBe('ready');
    if (link.status !== 'ready') return;
    expect(link.amount).toBe(190);
  });

  it('zapisuje się jako osobny rodzaj płatności', async () => {
    await resolveSettlementLink(1, 150, 'Naprawa turbiny', '127.0.0.1');
    expect(zapisane[0].kind).toBe('settlement');
    expect(zapisane[0].label).toBe('Naprawa turbiny');
    expect(zapisane[0].amount).toBe(150);
  });

  it('opis dopłaty trafia do bramki, żeby klient wiedział, za co płaci', async () => {
    await resolveSettlementLink(1, 80, 'Czyszczenie pogłębione', '127.0.0.1');
    expect(zapisane[0].label).toBe('Czyszczenie pogłębione');
  });

  it('odmawia kwoty zerowej i ujemnej', async () => {
    for (const kwota of [0, -50]) {
      const link = await resolveSettlementLink(1, kwota, 'Test', '127.0.0.1');
      expect(link.status).toBe('unavailable');
      if (link.status === 'unavailable') expect(link.reason).toMatch(/wi\u0119ksza od zera/);
    }
  });

  it('nie tworzy dopłaty dla nieistniejącej rezerwacji', async () => {
    const link = await resolveSettlementLink(999, 100, 'Test', '127.0.0.1');
    expect(link.status).toBe('unavailable');
    expect(zapisane).toHaveLength(0);
  });

  it('ponawia ten sam link zamiast tworzyć drugi na tę samą kwotę', async () => {
    const pierwszy = await resolveSettlementLink(1, 150, 'Naprawa', '127.0.0.1');
    if (pierwszy.status !== 'ready') throw new Error('brak linku');
    stanPlatnosci['settlement:Naprawa'] = {
      status: 'pending', redirect_url: pierwszy.url, session_id: pierwszy.sessionId,
      provider: 'testowy', amount: 150, label: 'Naprawa',
    };
    const drugi = await resolveSettlementLink(1, 150, 'Naprawa', '127.0.0.1');
    expect(drugi.status).toBe('ready');
    if (drugi.status !== 'ready') return;
    expect(drugi.reused).toBe(true);
    expect(zapisane).toHaveLength(1);
  });

  it('zmiana kwoty unieważnia poprzedni link — inaczej dałoby się zapłacić starą kwotę', async () => {
    const pierwszy = await resolveSettlementLink(1, 150, 'Naprawa', '127.0.0.1');
    if (pierwszy.status !== 'ready') throw new Error('brak linku');
    stanPlatnosci['settlement:Naprawa'] = {
      status: 'pending', redirect_url: pierwszy.url, session_id: pierwszy.sessionId,
      provider: 'testowy', amount: 150, label: 'Naprawa',
    };
    const drugi = await resolveSettlementLink(1, 220, 'Naprawa', '127.0.0.1');
    expect(drugi.status).toBe('ready');
    if (drugi.status !== 'ready') return;
    expect(drugi.reused).toBe(false);
    expect(drugi.amount).toBe(220);
    expect(zapisane).toHaveLength(2);
  });

  it('opłacona dopłata nie generuje kolejnego linku na tę samą kwotę', async () => {
    stanPlatnosci['settlement:Naprawa'] = { status: 'paid', amount: 150, provider: 'testowy', label: 'Naprawa' };
    const link = await resolveSettlementLink(1, 150, 'Naprawa', '127.0.0.1');
    expect(link.status).toBe('paid');
    expect(zapisane).toHaveLength(0);
  });

  it('kolejna, inna dopłata jest możliwa mimo opłaconej poprzedniej', async () => {
    stanPlatnosci['settlement:Naprawa'] = { status: 'paid', amount: 150, provider: 'testowy', label: 'Naprawa' };
    const link = await resolveSettlementLink(1, 90, 'Brakująca dysza', '127.0.0.1');
    expect(link.status).toBe('ready');
    if (link.status === 'ready') expect(link.amount).toBe(90);
  });

  it('nowa dopłata nie kasuje trwającej płatności za przedłużenie', async () => {
    const aneks = await resolveSettlementLink(1, 90, 'Przedłużenie najmu do 2026-08-14', '127.0.0.1');
    if (aneks.status !== 'ready') throw new Error('brak linku aneksu');
    stanPlatnosci['settlement:Przedłużenie najmu do 2026-08-14'] = {
      status: 'pending', redirect_url: aneks.url, session_id: aneks.sessionId,
      provider: 'testowy', amount: 90, label: 'Przedłużenie najmu do 2026-08-14',
    };

    await resolveSettlementLink(1, 185.5, 'Naprawa turbiny', '127.0.0.1');

    expect(stanPlatnosci['settlement:Przedłużenie najmu do 2026-08-14']?.status).toBe('pending');
  });
});
