// === Przelewy24 (REST API v1) ===
// Docs: https://developers.przelewy24.pl/
// Sandbox: https://sandbox.przelewy24.pl | Production: https://secure.przelewy24.pl
// Flow: POST /api/v1/transaction/register (sign sha384) -> token -> /trnRequest/{token}
// Notify: POST JSON with sign; then PUT /api/v1/transaction/verify to confirm.

import crypto from 'node:crypto';
import { config } from '../config.js';
import type { PaymentProvider, CreatePaymentInput, CreatePaymentResult, WebhookResult } from './types.js';

const baseUrl = () =>
  config.payments.p24.sandbox ? 'https://sandbox.przelewy24.pl' : 'https://secure.przelewy24.pl';

/** P24 sign: sha384 over compact JSON of specific fields (exported for tests). */
export function p24Sign(payload: Record<string, string | number>): string {
  return crypto.createHash('sha384').update(JSON.stringify(payload)).digest('hex');
}

const authHeader = () => {
  const { posId, apiKey } = config.payments.p24;
  return `Basic ${Buffer.from(`${posId}:${apiKey}`).toString('base64')}`;
};

export const przelewy24Provider: PaymentProvider = {
  name: 'przelewy24',

  isConfigured() {
    const { merchantId, posId, crc, apiKey } = config.payments.p24;
    return Boolean(merchantId && posId && crc && apiKey);
  },

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const { merchantId, posId, crc } = config.payments.p24;
    const amountGr = Math.round(input.amount * 100);

    const sign = p24Sign({
      sessionId: input.sessionId,
      merchantId: Number(merchantId),
      amount: amountGr,
      currency: 'PLN',
      crc,
    });

    const res = await fetch(`${baseUrl()}/api/v1/transaction/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(),
      },
      body: JSON.stringify({
        merchantId: Number(merchantId),
        posId: Number(posId),
        sessionId: input.sessionId,
        amount: amountGr,
        currency: 'PLN',
        description: input.description,
        email: input.customerEmail,
        country: 'PL',
        language: 'pl',
        urlReturn: input.returnUrl,
        urlStatus: input.notifyUrl,
        sign,
      }),
    });

    const body = (await res.json().catch(() => null)) as { data?: { token?: string }; error?: string } | null;

    if (!res.ok || !body?.data?.token) {
      throw new Error(`P24 register failed: HTTP ${res.status} ${JSON.stringify(body)}`);
    }

    return {
      redirectUrl: `${baseUrl()}/trnRequest/${body.data.token}`,
      externalId: body.data.token,
    };
  },

  async handleWebhook(_headers, rawBody): Promise<WebhookResult> {
    const { merchantId, posId, crc } = config.payments.p24;

    let n: {
      merchantId?: number;
      posId?: number;
      sessionId?: string;
      amount?: number;
      originAmount?: number;
      currency?: string;
      orderId?: number;
      methodId?: number;
      statement?: string;
      sign?: string;
    };
    try {
      n = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return { ok: false, reason: 'Invalid JSON body' };
    }

    if (!n.sessionId || !n.orderId || !n.sign) {
      return { ok: false, reason: 'Missing notification fields' };
    }

    const expectedSign = p24Sign({
      merchantId: n.merchantId!,
      posId: n.posId!,
      sessionId: n.sessionId,
      amount: n.amount!,
      originAmount: n.originAmount!,
      currency: n.currency!,
      orderId: n.orderId,
      methodId: n.methodId!,
      statement: n.statement!,
      crc,
    });

    const a = Buffer.from(String(n.sign));
    const b = Buffer.from(expectedSign);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, reason: 'Invalid sign' };
    }

    // Confirm the transaction (required by P24 to settle the payment)
    const verifySign = p24Sign({
      sessionId: n.sessionId,
      orderId: n.orderId,
      amount: n.amount!,
      currency: n.currency!,
      crc,
    });

    const verifyRes = await fetch(`${baseUrl()}/api/v1/transaction/verify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(),
      },
      body: JSON.stringify({
        merchantId: Number(merchantId),
        posId: Number(posId),
        sessionId: n.sessionId,
        amount: n.amount,
        currency: n.currency,
        orderId: n.orderId,
        sign: verifySign,
      }),
    });

    if (!verifyRes.ok) {
      return { ok: false, reason: `Verify failed: HTTP ${verifyRes.status}` };
    }

    return {
      ok: true,
      sessionId: n.sessionId,
      externalId: String(n.orderId),
      status: 'paid',
    };
  },
};
