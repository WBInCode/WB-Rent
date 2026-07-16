// === Stripe (Checkout Sessions, REST) ===
// Docs: https://docs.stripe.com/payments/checkout
// No SDK - plain REST (form-encoded) to keep all provider modules dependency-free.
// Flow: POST /v1/checkout/sessions -> session.url
// Webhook: Stripe-Signature: t=<ts>,v1=<hmac> ; v1 = HMAC-SHA256(secret, `${t}.${rawBody}`)

import crypto from 'node:crypto';
import { config } from '../config.js';
import type { PaymentProvider, CreatePaymentInput, CreatePaymentResult, WebhookResult } from './types.js';

const API = 'https://api.stripe.com';

/** Verify Stripe-Signature header (exported for tests). Tolerance: 5 min. */
export function verifyStripeSignature(
  signatureHeader: string | undefined,
  rawBody: Buffer,
  webhookSecret: string,
  nowMs = Date.now()
): boolean {
  if (!signatureHeader || !webhookSecret) return false;

  const parts = new Map<string, string[]>();
  for (const kv of signatureHeader.split(',')) {
    const i = kv.indexOf('=');
    if (i < 0) continue;
    const k = kv.slice(0, i).trim();
    const v = kv.slice(i + 1).trim();
    parts.set(k, [...(parts.get(k) || []), v]);
  }

  const t = parts.get('t')?.[0];
  const v1s = parts.get('v1') || [];
  if (!t || v1s.length === 0) return false;

  // Reject stale timestamps (replay protection)
  const tsMs = Number(t) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(nowMs - tsMs) > 5 * 60 * 1000) return false;

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${t}.${rawBody.toString('utf8')}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected);
  return v1s.some((v1) => {
    const buf = Buffer.from(v1);
    return buf.length === expectedBuf.length && crypto.timingSafeEqual(buf, expectedBuf);
  });
}

export const stripeProvider: PaymentProvider = {
  name: 'stripe',

  isConfigured() {
    const { secretKey, webhookSecret } = config.payments.stripe;
    return Boolean(secretKey && webhookSecret);
  },

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const form = new URLSearchParams({
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'pln',
      'line_items[0][price_data][unit_amount]': String(Math.round(input.amount * 100)),
      'line_items[0][price_data][product_data][name]': input.description.slice(0, 250),
      customer_email: input.customerEmail,
      client_reference_id: input.sessionId,
      'metadata[sessionId]': input.sessionId,
      success_url: input.returnUrl,
      cancel_url: input.returnUrl,
    });

    const res = await fetch(`${API}/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.payments.stripe.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });

    const body = (await res.json().catch(() => null)) as { id?: string; url?: string; error?: { message?: string } } | null;

    if (!res.ok || !body?.url) {
      throw new Error(`Stripe session create failed: HTTP ${res.status} ${body?.error?.message || ''}`);
    }

    return { redirectUrl: body.url, externalId: body.id };
  },

  async handleWebhook(headers, rawBody): Promise<WebhookResult> {
    const sigHeader = headers['stripe-signature'];
    const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

    if (!verifyStripeSignature(signature, rawBody, config.payments.stripe.webhookSecret)) {
      return { ok: false, reason: 'Invalid Stripe-Signature' };
    }

    let event: {
      type?: string;
      data?: { object?: { id?: string; client_reference_id?: string; metadata?: { sessionId?: string } } };
    };
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return { ok: false, reason: 'Invalid JSON body' };
    }

    const obj = event.data?.object;
    const sessionId = obj?.client_reference_id || obj?.metadata?.sessionId;
    if (!sessionId) return { ok: false, reason: 'Missing session reference' };

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return { ok: true, sessionId, externalId: obj?.id, status: 'paid' };
      case 'checkout.session.async_payment_failed':
        return { ok: true, sessionId, externalId: obj?.id, status: 'failed' };
      case 'checkout.session.expired':
        return { ok: true, sessionId, externalId: obj?.id, status: 'cancelled' };
      default:
        return { ok: false, reason: `Ignored event type: ${event.type}` };
    }
  },
};
