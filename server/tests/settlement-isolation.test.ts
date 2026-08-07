/**
 * Dopłaty i przedłużenia nie mogą się nawzajem kasować.
 *
 * Reguła „jedna żywa sesja płatności" była pisana pod czynsz najmu. Gdy doszły
 * dopłaty rozliczeniowe i przedłużenia, zaczęła unieważniać cudze płatności:
 * przyjęcie gotówki za najem kasowało przedłużenie, które klient właśnie
 * opłacał, a dopłata za naprawę robiła to samo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.NODE_ENV = 'test';

type Platnosc = { session_id: string; kind: string; label: string | null; status: string; amount: number };

const platnosci: Platnosc[] = [];

vi.mock('../src/db.js', () => ({
  queries: {
    getReservationById: async (id: number) => ({
      id, product_id: 'puzzi-10-1', email: 'k@example.com', total_price: 190, status: 'confirmed',
    }),
    getSettlementByLabel: async (_id: number, label: string) =>
      [...platnosci].reverse().find((p) => p.kind === 'settlement' && p.label === label),
    getLatestPaymentForReservation: async (_id: number, kind: string) =>
      [...platnosci].reverse().find((p) => p.kind === kind),
    cancelPendingPayments: async (_id: number, kind: string, label?: string) => {
      for (const p of platnosci) {
        if (p.status !== 'pending' || p.kind !== kind) continue;
        if (label !== undefined && p.label !== label) continue;
        p.status = 'cancelled';
      }
      return [];
    },
    insertPayment: async (dane: any) => {
      platnosci.push({
        session_id: dane.sessionId, kind: dane.kind, label: dane.label ?? null,
        status: 'pending', amount: dane.amount,
      });
      return { lastInsertRowid: platnosci.length };
    },
    hasSignedContract: async () => true,
  },
}));

vi.mock('../src/payments/index.js', () => ({
  getActiveProvider: () => ({
    name: 'testowy',
    createPayment: async (input: any) => ({ redirectUrl: `https://bramka.test/${input.sessionId}`, externalId: 'x' }),
  }),
  getProviderByName: () => null,
}));

const { resolveSettlementLink, resolvePaymentLink } = await import('../src/payments/routes.js');

const stan = (label: string) => platnosci.find((p) => p.label === label)?.status;

beforeEach(() => { platnosci.length = 0; });

describe('dopłaty nie kasują się nawzajem', () => {
  it('dopłata za naprawę nie unieważnia opłacanego przedłużenia', async () => {
    await resolveSettlementLink(1, 135, 'Przedłużenie najmu do 2026-08-14', '127.0.0.1');
    await resolveSettlementLink(1, 120, 'Naprawa węża ssącego', '127.0.0.1');

    expect(stan('Przedłużenie najmu do 2026-08-14')).toBe('pending');
    expect(stan('Naprawa węża ssącego')).toBe('pending');
  });

  it('ponowna wycena tej samej należności unieważnia poprzednią kwotę', async () => {
    await resolveSettlementLink(1, 120, 'Naprawa węża ssącego', '127.0.0.1');
    await resolveSettlementLink(1, 260, 'Naprawa węża ssącego', '127.0.0.1');

    const naprawy = platnosci.filter((p) => p.label === 'Naprawa węża ssącego');
    expect(naprawy).toHaveLength(2);
    expect(naprawy[0].status).toBe('cancelled');
    expect(naprawy[1].status).toBe('pending');
  });

  it('nowa sesja za czynsz najmu nie rusza dopłat rozliczeniowych', async () => {
    await resolveSettlementLink(1, 135, 'Przedłużenie najmu do 2026-08-14', '127.0.0.1');
    await resolvePaymentLink(1, '127.0.0.1');
    await resolvePaymentLink(1, '127.0.0.1');

    expect(stan('Przedłużenie najmu do 2026-08-14')).toBe('pending');
  });

  it('kilka różnych dopłat może czekać na zapłatę równocześnie', async () => {
    await resolveSettlementLink(1, 135, 'Przedłużenie najmu', '127.0.0.1');
    await resolveSettlementLink(1, 120, 'Naprawa', '127.0.0.1');
    await resolveSettlementLink(1, 30, 'Czyszczenie pogłębione', '127.0.0.1');

    const czekajace = platnosci.filter((p) => p.status === 'pending' && p.kind === 'settlement');
    expect(czekajace).toHaveLength(3);
    expect(czekajace.map((p) => p.amount).sort((a, b) => a - b)).toEqual([30, 120, 135]);
  });
});
