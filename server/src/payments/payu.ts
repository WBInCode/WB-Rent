// === PayU (REST API v2.1) ===
// Docs: https://developers.payu.com/europe/pl/docs/
// Sandbox: https://secure.snd.payu.com | Production: https://secure.payu.com
// Flow: OAuth client_credentials -> POST /api/v2_1/orders -> redirectUri
// Notify: POST JSON { order: { status, extOrderId, orderId } } with
//         OpenPayU-Signature header: signature=<hex>;algorithm=<MD5|SHA-256>
//         where <hex> = hash(rawBody + secondKey)

import crypto from 'node:crypto';
import { config } from '../config.js';
import type { PaymentProvider, CreatePaymentInput, CreatePaymentResult, WebhookResult, PaymentStatus } from './types.js';

const baseUrl = () =>
  config.payments.payu.sandbox ? 'https://secure.snd.payu.com' : 'https://secure.payu.com';

// --- OAuth token cache ---
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.token;
  }

  const { clientId, clientSecret } = config.payments.payu;
  const res = await fetch(`${baseUrl()}/pl/standard/user/oauth/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`PayU OAuth failed: HTTP ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

/** Verify OpenPayU-Signature header against the raw body (exported for tests). */
export function verifyPayuSignature(
  signatureHeader: string | undefined,
  rawBody: Buffer,
  secondKey: string
): boolean {
  if (!signatureHeader || !secondKey) return false;

  // Header format: "sender=checkout;signature=<hex>;algorithm=MD5;content=DOCUMENT"
  const parts = Object.fromEntries(
    signatureHeader.split(';').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim().toLowerCase(), kv.slice(i + 1).trim()];
    })
  );

  const signature = parts['signature'];
  const algorithm = (parts['algorithm'] || 'MD5').toUpperCase();
  if (!signature) return false;

  const algo = algorithm === 'SHA-256' || algorithm === 'SHA256' ? 'sha256' : algorithm === 'MD5' ? 'md5' : null;
  if (!algo) return false;

  const expected = crypto
    .createHash(algo)
    .update(Buffer.concat([rawBody, Buffer.from(secondKey)]))
    .digest('hex');

  const a = Buffer.from(signature.toLowerCase());
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function mapStatus(payuStatus: string): PaymentStatus {
  switch (payuStatus) {
    case 'COMPLETED':
      return 'paid';
    case 'CANCELED':
      return 'cancelled';
    case 'REJECTED':
      return 'failed';
    default:
      return 'pending'; // NEW / PENDING / WAITING_FOR_CONFIRMATION
  }
}

export const payuProvider: PaymentProvider = {
  name: 'payu',

  isConfigured() {
    const { posId, secondKey, clientId, clientSecret } = config.payments.payu;
    return Boolean(posId && secondKey && clientId && clientSecret);
  },

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const token = await getAccessToken();

    const res = await fetch(`${baseUrl()}/api/v2_1/orders`, {
      method: 'POST',
      redirect: 'manual', // PayU responds 302 with a JSON body - don't follow
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        merchantPosId: config.payments.payu.posId,
        extOrderId: input.sessionId,
        description: input.description,
        currencyCode: 'PLN',
        totalAmount: String(Math.round(input.amount * 100)), // grosze
        customerIp: input.customerIp || '127.0.0.1',
        notifyUrl: input.notifyUrl,
        continueUrl: input.returnUrl,
        buyer: { email: input.customerEmail, language: 'pl' },
        products: [
          {
            name: input.description.slice(0, 255),
            unitPrice: String(Math.round(input.amount * 100)),
            quantity: '1',
          },
        ],
      }),
    });

    const body = (await res.json().catch(() => null)) as {
      status?: { statusCode?: string };
      redirectUri?: string;
      orderId?: string;
    } | null;

    if (!body || body.status?.statusCode !== 'SUCCESS' || !body.redirectUri) {
      throw new Error(`PayU order create failed: HTTP ${res.status} ${JSON.stringify(body)}`);
    }

    return { redirectUrl: body.redirectUri, externalId: body.orderId };
  },

  async handleWebhook(headers, rawBody): Promise<WebhookResult> {
    const sigHeader = headers['openpayu-signature'];
    const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

    if (!verifyPayuSignature(signature, rawBody, config.payments.payu.secondKey)) {
      return { ok: false, reason: 'Invalid OpenPayU-Signature' };
    }

    let parsed: { order?: { orderId?: string; extOrderId?: string; status?: string } };
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return { ok: false, reason: 'Invalid JSON body' };
    }

    const order = parsed.order;
    if (!order?.extOrderId || !order.status) {
      // Refund notifications etc. - acknowledge without state change
      return { ok: false, reason: 'Not an order notification' };
    }

    return {
      ok: true,
      sessionId: order.extOrderId,
      externalId: order.orderId,
      status: mapStatus(order.status),
    };
  },
};
