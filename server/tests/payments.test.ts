import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';

// Payment modules read config at import time - set env first
process.env.NODE_ENV = 'test';
process.env.ADMIN_TOKEN = 'test-secret';
process.env.PAYMENT_PROVIDER = 'payu';
process.env.PAYU_POS_ID = '300746';
process.env.PAYU_SECOND_KEY = 'test-second-key';
process.env.PAYU_CLIENT_ID = '300746';
process.env.PAYU_CLIENT_SECRET = 'x';

const { verifyPayuSignature } = await import('../src/payments/payu.js');
const { verifyStripeSignature } = await import('../src/payments/stripe.js');
const { p24Sign } = await import('../src/payments/przelewy24.js');
const { getActiveProvider, getProviderByName } = await import('../src/payments/index.js');

describe('PayU: weryfikacja OpenPayU-Signature', () => {
  const secondKey = 'test-second-key';
  const body = Buffer.from(JSON.stringify({ order: { extOrderId: 'wbrent-1-abc', status: 'COMPLETED' } }));
  const md5 = crypto.createHash('md5').update(Buffer.concat([body, Buffer.from(secondKey)])).digest('hex');
  const sha256 = crypto.createHash('sha256').update(Buffer.concat([body, Buffer.from(secondKey)])).digest('hex');

  it('akceptuje poprawny podpis MD5', () => {
    expect(verifyPayuSignature(`sender=checkout;signature=${md5};algorithm=MD5;content=DOCUMENT`, body, secondKey)).toBe(true);
  });

  it('akceptuje poprawny podpis SHA-256', () => {
    expect(verifyPayuSignature(`signature=${sha256};algorithm=SHA-256`, body, secondKey)).toBe(true);
  });

  it('odrzuca zły podpis', () => {
    expect(verifyPayuSignature(`signature=${'0'.repeat(32)};algorithm=MD5`, body, secondKey)).toBe(false);
  });

  it('odrzuca podpis policzony innym kluczem', () => {
    const evil = crypto.createHash('md5').update(Buffer.concat([body, Buffer.from('other-key')])).digest('hex');
    expect(verifyPayuSignature(`signature=${evil};algorithm=MD5`, body, secondKey)).toBe(false);
  });

  it('odrzuca brak nagłówka / brak klucza', () => {
    expect(verifyPayuSignature(undefined, body, secondKey)).toBe(false);
    expect(verifyPayuSignature(`signature=${md5};algorithm=MD5`, body, '')).toBe(false);
  });

  it('odrzuca zmodyfikowane body', () => {
    const tampered = Buffer.from(body.toString().replace('COMPLETED', 'CANCELED'));
    expect(verifyPayuSignature(`signature=${md5};algorithm=MD5`, tampered, secondKey)).toBe(false);
  });
});

describe('Stripe: weryfikacja Stripe-Signature', () => {
  const secret = 'whsec_test';
  const body = Buffer.from(JSON.stringify({ type: 'checkout.session.completed' }));
  const now = Date.now();
  const t = Math.floor(now / 1000);
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${body.toString()}`).digest('hex');

  it('akceptuje poprawny podpis', () => {
    expect(verifyStripeSignature(`t=${t},v1=${v1}`, body, secret, now)).toBe(true);
  });

  it('odrzuca zły podpis', () => {
    expect(verifyStripeSignature(`t=${t},v1=${'0'.repeat(64)}`, body, secret, now)).toBe(false);
  });

  it('odrzuca przeterminowany timestamp (replay)', () => {
    const oldT = t - 10 * 60; // 10 min temu
    const oldSig = crypto.createHmac('sha256', secret).update(`${oldT}.${body.toString()}`).digest('hex');
    expect(verifyStripeSignature(`t=${oldT},v1=${oldSig}`, body, secret, now)).toBe(false);
  });

  it('akceptuje jeden poprawny v1 spośród wielu', () => {
    expect(verifyStripeSignature(`t=${t},v1=${'0'.repeat(64)},v1=${v1}`, body, secret, now)).toBe(true);
  });
});

describe('Przelewy24: sign sha384', () => {
  it('liczy deterministyczny podpis z kolejnością pól', () => {
    const sign = p24Sign({ sessionId: 's1', merchantId: 12345, amount: 13500, currency: 'PLN', crc: 'crc123' });
    const expected = crypto
      .createHash('sha384')
      .update(JSON.stringify({ sessionId: 's1', merchantId: 12345, amount: 13500, currency: 'PLN', crc: 'crc123' }))
      .digest('hex');
    expect(sign).toBe(expected);
    expect(sign).toHaveLength(96);
  });
});

describe('rejestr providerów', () => {
  it('aktywny provider = payu (z env)', () => {
    expect(getActiveProvider()?.name).toBe('payu');
  });

  it('lookup po nazwie', () => {
    expect(getProviderByName('payu')?.name).toBe('payu');
    expect(getProviderByName('przelewy24')?.name).toBe('przelewy24');
    expect(getProviderByName('stripe')?.name).toBe('stripe');
    expect(getProviderByName('nieznany')).toBeNull();
  });

  it('nieskonfigurowane moduły zgłaszają isConfigured() = false', () => {
    // P24 i Stripe nie mają credentiali w tym teście
    expect(getProviderByName('przelewy24')!.isConfigured()).toBe(false);
    expect(getProviderByName('stripe')!.isConfigured()).toBe(false);
    expect(getProviderByName('payu')!.isConfigured()).toBe(true);
  });
});

describe('PayU: odbiór, odpytanie statusu i zwrot', () => {
  const payu = getProviderByName('payu')!;
  const secondKey = 'test-second-key';

  const podpisz = (payload: object) => {
    const body = Buffer.from(JSON.stringify(payload));
    const hash = crypto.createHash('md5').update(Buffer.concat([body, Buffer.from(secondKey)])).digest('hex');
    return { body, header: `signature=${hash};algorithm=MD5` };
  };

  it('WAITING_FOR_CONFIRMATION zgłasza potrzebę odbioru środków', async () => {
    const { body, header } = podpisz({
      order: { extOrderId: 'wbrent-7-aa', orderId: 'PAYU-7', status: 'WAITING_FOR_CONFIRMATION' },
    });
    const wynik = await payu.handleWebhook({ 'openpayu-signature': header }, body);
    expect(wynik.ok).toBe(true);
    if (wynik.ok) {
      expect(wynik.status).toBe('pending');
      expect(wynik.needsCapture).toBe(true);
      expect(wynik.externalId).toBe('PAYU-7');
    }
  });

  it('COMPLETED nie wywołuje odbioru środków', async () => {
    const { body, header } = podpisz({
      order: { extOrderId: 'wbrent-8-bb', orderId: 'PAYU-8', status: 'COMPLETED' },
    });
    const wynik = await payu.handleWebhook({ 'openpayu-signature': header }, body);
    expect(wynik.ok).toBe(true);
    if (wynik.ok) {
      expect(wynik.status).toBe('paid');
      expect(wynik.needsCapture).toBe(false);
    }
  });

  it('moduł udostępnia odbiór, odpytanie statusu i zwrot', () => {
    expect(typeof payu.capture).toBe('function');
    expect(typeof payu.fetchStatus).toBe('function');
    expect(typeof payu.refund).toBe('function');
  });

  it('fetchStatus mapuje odpowiedź bramki na status systemowy', async () => {
    const oryginalny = globalThis.fetch;
    const wywolania: string[] = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      wywolania.push(String(url));
      if (String(url).includes('/oauth/authorize')) {
        return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      }
      expect(init?.method).toBe('GET');
      return new Response(JSON.stringify({ orders: [{ status: 'COMPLETED' }] }), { status: 200 });
    }) as unknown as typeof fetch;

    try {
      expect(await payu.fetchStatus!('PAYU-9')).toBe('paid');
      expect(wywolania.some((u) => u.includes('/api/v2_1/orders/PAYU-9'))).toBe(true);
    } finally {
      globalThis.fetch = oryginalny;
    }
  });

  it('zwrot wysyła kwotę w groszach i opis do bramki', async () => {
    const oryginalny = globalThis.fetch;
    let cialo: any = null;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (String(url).includes('/oauth/authorize')) {
        return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      }
      expect(String(url)).toContain('/api/v2_1/orders/PAYU-10/refunds');
      cialo = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ status: { statusCode: 'SUCCESS' }, refund: { refundId: 'R-1' } }), { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const wynik = await payu.refund!({ externalId: 'PAYU-10', amount: 45.5, reason: 'Zwrot kaucji' });
      expect(wynik.refundId).toBe('R-1');
      expect(cialo.refund.amount).toBe('4550');
      expect(cialo.refund.description).toBe('Zwrot kaucji');
    } finally {
      globalThis.fetch = oryginalny;
    }
  });

  it('brak kwoty oznacza zwrot całości', async () => {
    const oryginalny = globalThis.fetch;
    let cialo: any = null;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (String(url).includes('/oauth/authorize')) {
        return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      }
      cialo = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ status: { statusCode: 'SUCCESS' } }), { status: 200 });
    }) as unknown as typeof fetch;

    try {
      await payu.refund!({ externalId: 'PAYU-11', reason: 'Rezygnacja klienta' });
      expect(cialo.refund.amount).toBeUndefined();
    } finally {
      globalThis.fetch = oryginalny;
    }
  });

  it('odrzucony zwrot kończy się błędem, a nie cichym sukcesem', async () => {
    const oryginalny = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      if (String(url).includes('/oauth/authorize')) {
        return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ status: { statusCode: 'ERROR_VALUE_INVALID' } }), { status: 400 });
    }) as unknown as typeof fetch;

    try {
      await expect(payu.refund!({ externalId: 'PAYU-12', reason: 'test' })).rejects.toThrow(/refund failed/i);
    } finally {
      globalThis.fetch = oryginalny;
    }
  });
});
