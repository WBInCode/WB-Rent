// === PAYMENT ROUTES ===
// GET  /api/payments/config              - is a gateway enabled + which one
// POST /api/payments/create              - create payment for a reservation (retry-friendly)
// GET  /api/payments/status/:sessionId   - poll payment status (return page)
// POST /api/payments/webhook/:provider   - gateway notifications (signature-verified)

import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { queries } from '../db.js';
import { config } from '../config.js';
import { getActiveProvider, getProviderByName } from './index.js';
import { getProductName } from '../products.js';

const router = Router();

/** Build payment input and call the active provider. Shared with POST /reservations. */
export async function createPaymentForReservation(reservation: {
  id: number;
  product_id: string;
  items?: Array<{ product_id: string }>;
  email: string;
  total_price: number;
}, customerIp: string): Promise<{ redirectUrl: string; sessionId: string } | null> {
  const provider = getActiveProvider();
  if (!provider) return null;

  const sessionId = `wbrent-${reservation.id}-${crypto.randomBytes(8).toString('hex')}`;
  const productIds = reservation.items?.length
    ? reservation.items.map((item) => item.product_id)
    : [reservation.product_id];
  const productDescription = productIds.map(getProductName).join(', ');

  const result = await provider.createPayment({
    sessionId,
    amount: reservation.total_price,
    description: `WB-Rent: ${productDescription} (rezerwacja #${reservation.id})`.slice(0, 255),
    customerEmail: reservation.email,
    customerIp,
    returnUrl: `${config.siteUrl}/platnosc?sesja=${sessionId}`,
    notifyUrl: `${config.apiUrl}/api/payments/webhook/${provider.name}`,
  });

  await queries.insertPayment({
    reservationId: reservation.id,
    provider: provider.name,
    sessionId,
    externalId: result.externalId,
    amount: reservation.total_price,
    redirectUrl: result.redirectUrl,
  });

  return { redirectUrl: result.redirectUrl, sessionId };
}

/**
 * Ask the gateway what really happened. Webhooks get lost (network, deploy,
 * misconfigured notify URL) and without this a paid rental stays 'pending' forever.
 */
async function syncPaymentWithGateway(payment: {
  session_id: string;
  provider: string;
  external_id?: string | null;
  status: string;
}): Promise<string> {
  if (payment.status !== 'pending' || !payment.external_id) return payment.status;

  const provider = getProviderByName(payment.provider);
  if (!provider?.isConfigured() || !provider.fetchStatus) return payment.status;

  try {
    const remote = await provider.fetchStatus(payment.external_id);
    await queries.touchPaymentChecked(payment.session_id);
    if (!remote || remote === 'pending') return payment.status;

    await queries.updatePaymentStatus({ sessionId: payment.session_id, status: remote });
    console.log(`💳 Uzgodniono ${payment.session_id}: pending -> ${remote} (${payment.provider})`);
    return remote;
  } catch (error) {
    console.error(`Nie udało się odpytać bramki o ${payment.session_id}:`, error);
    return payment.status;
  }
}

/** Periodic safety net for payments whose notification never arrived. */
export async function reconcilePendingPayments(minAgeSeconds = 120): Promise<number> {
  const stale = await queries.getStalePendingPayments(minAgeSeconds);
  let zmienione = 0;
  for (const payment of stale) {
    const status = await syncPaymentWithGateway(payment);
    if (status !== 'pending') zmienione += 1;
  }
  return zmienione;
}

// --- Public config (frontend feature detection) ---
router.get('/config', (_req: Request, res: Response) => {
  const provider = getActiveProvider();
  res.json({
    success: true,
    enabled: provider !== null,
    provider: provider?.name || null,
  });
});

// --- Create (or retry) a payment for a reservation ---
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { reservationId, email } = req.body as { reservationId?: number; email?: string };

    if (!reservationId || !email) {
      res.status(400).json({ success: false, message: 'Podaj reservationId i email' });
      return;
    }

    const provider = getActiveProvider();
    if (!provider) {
      res.status(503).json({ success: false, message: 'Płatności online są obecnie niedostępne' });
      return;
    }

    const reservation = await queries.getReservationById(Number(reservationId));
    // Email must match the reservation (no resource enumeration)
    if (!reservation || reservation.email.toLowerCase() !== String(email).toLowerCase()) {
      res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
      return;
    }

    if (reservation.payment_status === 'paid') {
      res.status(409).json({ success: false, message: 'Ta rezerwacja jest już opłacona' });
      return;
    }

    if (['rejected', 'cancelled'].includes(reservation.status)) {
      res.status(409).json({ success: false, message: 'Rezerwacja została anulowana' });
      return;
    }

    if (config.contracts.enabled && config.contracts.requireBeforePayment) {
      const signed = await queries.hasSignedContract(reservation.id);
      if (!signed) {
        res.status(409).json({
          success: false,
          message: 'Płatność jest dostępna dopiero po podpisaniu umowy najmu',
        });
        return;
      }
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || '127.0.0.1';

    const payment = await createPaymentForReservation(reservation, clientIp);
    if (!payment) {
      res.status(503).json({ success: false, message: 'Płatności online są obecnie niedostępne' });
      return;
    }

    res.status(201).json({ success: true, ...payment });
  } catch (error) {
    console.error('Payment create error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się utworzyć płatności. Spróbuj ponownie.' });
  }
});

// --- Status polling (session id is unguessable) ---
router.get('/status/:sessionId', async (req: Request, res: Response) => {
  try {
    const payment = await queries.getPaymentBySessionId(String(req.params.sessionId));
    if (!payment) {
      res.status(404).json({ success: false, message: 'Płatność nie znaleziona' });
      return;
    }

    // Strona powrotu odpytuje co 3 s - bramkę pytamy najwyżej raz na 15 s.
    const ostatnieSprawdzenie = payment.last_checked_at ? new Date(payment.last_checked_at).getTime() : 0;
    const status = Date.now() - ostatnieSprawdzenie > 15_000
      ? await syncPaymentWithGateway(payment)
      : payment.status;

    res.json({
      success: true,
      status,
      amount: payment.amount,
      reservationId: payment.reservation_id,
      provider: payment.provider,
    });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// --- Gateway webhooks ---
router.post('/webhook/:provider', async (req: Request, res: Response) => {
  const providerName = String(req.params.provider);
  const provider = getProviderByName(providerName);

  if (!provider || !provider.isConfigured()) {
    res.status(404).json({ success: false, message: 'Unknown provider' });
    return;
  }

  const rawBody: Buffer | undefined = (req as any).rawBody;
  if (!rawBody) {
    res.status(400).json({ success: false, message: 'Missing body' });
    return;
  }

  try {
    const result = await provider.handleWebhook(req.headers, rawBody);

    if (!result.ok) {
      console.warn(`💳 Webhook ${providerName} rejected: ${result.reason}`);
      // Signature failures -> 400 (provider will retry); ignored events -> 200
      const isSignatureIssue = /signature|sign/i.test(result.reason);
      res.status(isSignatureIssue ? 400 : 200).json({ success: false, message: result.reason });
      return;
    }

    // Never downgrade a paid payment (out-of-order notifications)
    const existing = await queries.getPaymentBySessionId(result.sessionId);
    if (!existing) {
      console.warn(`💳 Webhook ${providerName}: unknown session ${result.sessionId}`);
      res.status(200).json({ success: true });
      return;
    }

    if (existing.status !== 'paid') {
      await queries.updatePaymentStatus({
        sessionId: result.sessionId,
        status: result.status,
        externalId: result.externalId,
      });
      console.log(`💳 Payment ${result.sessionId} -> ${result.status} (${providerName})`);
    }

    // Punkt bez automatycznego odbioru trzyma srodki do czasu potwierdzenia.
    if (result.needsCapture && result.externalId && provider.capture) {
      try {
        await provider.capture(result.externalId);
        console.log(`💳 Odebrano platnosc ${result.sessionId} (${providerName})`);
      } catch (error) {
        console.error(`Nie udalo sie odebrac platnosci ${result.sessionId}:`, error);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`Webhook ${providerName} error:`, error);
    res.status(500).json({ success: false });
  }
});

export default router;
