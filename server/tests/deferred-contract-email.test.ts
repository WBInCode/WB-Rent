/**
 * Obsługa przy ladzie: umowa i protokół wydania w jednej wiadomości.
 *
 * Gdy pracownik prowadzi cały wynajem na miejscu, oba dokumenty powstają
 * w odstępie minut. Dwa maile pod rząd o tej samej transakcji to prosta droga
 * do folderu spam, więc umowa czeka — ale nie może zaginąć, jeśli do wydania
 * nigdy nie dojdzie.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.NODE_ENV = 'test';

type Umowa = {
  id: number;
  status: string;
  email_sent_at: string | null;
  email_deferred_at: string | null;
};

const stan: { umowa: Umowa } = {
  umowa: { id: 7, status: 'signed', email_sent_at: null, email_deferred_at: null },
};

vi.mock('../src/db.js', () => ({
  queries: {
    markContractEmailed: async (id: number) => {
      if (stan.umowa.id === id) {
        stan.umowa.email_sent_at = new Date().toISOString();
        stan.umowa.email_deferred_at = null;
      }
    },
    deferContractEmail: async (id: number) => {
      if (stan.umowa.id === id) stan.umowa.email_deferred_at = new Date().toISOString();
    },
    getStaleDeferredContracts: async (godzin: number) => {
      const u = stan.umowa;
      if (u.status !== 'signed' || u.email_sent_at || !u.email_deferred_at) return [];
      const wiek = Date.now() - Date.parse(u.email_deferred_at);
      return wiek >= godzin * 3600_000 ? [u] : [];
    },
  },
}));

const { queries } = await import('../src/db.js');

beforeEach(() => {
  stan.umowa = { id: 7, status: 'signed', email_sent_at: null, email_deferred_at: null };
});

describe('wstrzymanie maila z umową', () => {
  it('wstrzymana umowa nie jest oznaczona jako wysłana', async () => {
    await queries.deferContractEmail(7);
    expect(stan.umowa.email_deferred_at).not.toBeNull();
    expect(stan.umowa.email_sent_at).toBeNull();
  });

  it('wysyłka razem z protokołem zamyka oczekiwanie', async () => {
    await queries.deferContractEmail(7);
    await queries.markContractEmailed(7);
    expect(stan.umowa.email_sent_at).not.toBeNull();
    expect(stan.umowa.email_deferred_at).toBeNull();
  });

  it('świeżo wstrzymana umowa nie jest jeszcze zaległością', async () => {
    await queries.deferContractEmail(7);
    expect(await queries.getStaleDeferredContracts(2)).toHaveLength(0);
  });

  it('umowa czekająca ponad dwie godziny trafia do wysyłki mimo braku wydania', async () => {
    stan.umowa.email_deferred_at = new Date(Date.now() - 3 * 3600_000).toISOString();
    const zalegle = await queries.getStaleDeferredContracts(2);
    expect(zalegle).toHaveLength(1);
    expect(zalegle[0].id).toBe(7);
  });

  it('wysłana umowa nigdy nie wraca jako zaległość', async () => {
    stan.umowa.email_deferred_at = new Date(Date.now() - 5 * 3600_000).toISOString();
    await queries.markContractEmailed(7);
    expect(await queries.getStaleDeferredContracts(2)).toHaveLength(0);
  });

  it('umowa niepodpisana nie jest wysyłana automatycznie', async () => {
    stan.umowa.status = 'ready';
    stan.umowa.email_deferred_at = new Date(Date.now() - 5 * 3600_000).toISOString();
    expect(await queries.getStaleDeferredContracts(2)).toHaveLength(0);
  });

  it('umowa wysłana normalnie (bez wstrzymania) nie jest zaległością', async () => {
    await queries.markContractEmailed(7);
    expect(await queries.getStaleDeferredContracts(2)).toHaveLength(0);
  });
});
