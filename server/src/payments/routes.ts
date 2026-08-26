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
}, customerIp: string, naleznosc?: {
  kind: 'rental' | 'settlement';
  amount: number;
  label: string;
}): Promise<{ redirectUrl: string; sessionId: string } | null> {
  const provider = getActiveProvider();
  if (!provider) return null;

  const kwota = naleznosc ? naleznosc.amount : reservation.total_price;
  const sessionId = `wbrent-${reservation.id}-${crypto.randomBytes(8).toString('hex')}`;
  const productIds = reservation.items?.length
    ? reservation.items.map((item) => item.product_id)
    : [reservation.product_id];
  const productDescription = productIds.map(getProductName).join(', ');
  const opis = naleznosc
    ? `WB-Rent: ${naleznosc.label} (rezerwacja #${reservation.id})`
    : `WB-Rent: ${productDescription} (rezerwacja #${reservation.id})`;

  const result = await provider.createPayment({
    sessionId,
    amount: kwota,
    description: opis.slice(0, 255),
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
    amount: kwota,
    redirectUrl: result.redirectUrl,
    kind: naleznosc?.kind || 'rental',
    label: naleznosc?.label,
  });

  return { redirectUrl: result.redirectUrl, sessionId };
}

export type PaymentLinkResult =
  | { status: 'ready'; url: string; sessionId: string; amount: number; provider: string; reused: boolean }
  | { status: 'paid' }
  | { status: 'unavailable'; reason: string; amount: number; canPayManually: boolean };

/**
 * Czy klient moze teraz sam ruszyc platnosc online. Te same warunki co
 * resolvePaymentLink, ale bez zakladania sesji w bramce - zeby samo wyswietlenie
 * listy rezerwacji nie tworzylo platnosci.
 */
export function canCustomerPayOnline(reservation: {
  status: string;
  payment_status?: string | null;
  contract_status?: string | null;
}): boolean {
  if (reservation.payment_status === 'paid') return false;
  if (['rejected', 'cancelled'].includes(reservation.status)) return false;
  if (!getActiveProvider()) return false;
  if (config.contracts.enabled && config.contracts.requireBeforePayment) {
    return reservation.contract_status === 'signed';
  }
  return true;
}

/**
 * Exactly one live payment link per reservation. Minting a fresh gateway session
 * on every click would leave several openable links and invite paying twice, so
 * the pending session is reused until the amount changes or it gets paid.
 */
export async function resolvePaymentLink(
  reservationId: number,
  customerIp: string
): Promise<PaymentLinkResult> {
  const reservation = await queries.getReservationById(reservationId);
  if (!reservation) {
    return { status: 'unavailable', reason: 'Rezerwacja nie istnieje', amount: 0, canPayManually: false };
  }
  if (reservation.payment_status === 'paid') return { status: 'paid' };

  const amount = Number(reservation.total_price);

  if (['rejected', 'cancelled'].includes(reservation.status)) {
    return { status: 'unavailable', reason: 'Rezerwacja została anulowana', amount, canPayManually: false };
  }

  if (config.contracts.enabled && config.contracts.requireBeforePayment) {
    const signed = await queries.hasSignedContract(reservationId);
    if (!signed) {
      return {
        status: 'unavailable',
        reason: 'Najpierw musi zostać podpisana umowa najmu',
        amount,
        canPayManually: false,
      };
    }
  }

  const provider = getActiveProvider();
  if (!provider) {
    // Bramka wyłączona nie znaczy, że klient nie może zapłacić przy ladzie.
    return {
      status: 'unavailable',
      reason: 'Płatności online są obecnie wyłączone',
      amount,
      canPayManually: true,
    };
  }

  const latest = await queries.getLatestPaymentForReservation(reservationId);
  const reusable = latest
    && latest.status === 'pending'
    && latest.redirect_url
    && latest.provider === provider.name
    && Number(latest.amount) === amount;

  if (reusable) {
    return {
      status: 'ready',
      url: latest.redirect_url,
      sessionId: latest.session_id,
      amount: Number(latest.amount),
      provider: latest.provider,
      reused: true,
    };
  }

  // A stale session for a different amount must not stay payable.
  await queries.cancelPendingPayments(reservationId);

  const created = await createPaymentForReservation(reservation, customerIp);
  if (!created) {
    return {
      status: 'unavailable',
      reason: 'Nie udało się utworzyć płatności online',
      amount,
      canPayManually: true,
    };
  }

  return {
    status: 'ready',
    url: created.redirectUrl,
    sessionId: created.sessionId,
    amount,
    provider: provider.name,
    reused: false,
  };
}

/**
 * Link do doplaty rozliczeniowej - saldo z protokolu zwrotu albo koszt naprawy
 * wyceniony przez serwis.
 *
 * To osobna naleznosc od czynszu najmu: ma wlasna kwote, wlasny opis i wlasny
 * los. Wczesniej kazdy link platnosci opiewal na `total_price`, wiec mail
 * obiecywal doplate 150 zl, a bramka zadala calej kwoty najmu.
 */
export async function resolveSettlementLink(
  reservationId: number,
  kwota: number,
  opis: string,
  customerIp: string
): Promise<PaymentLinkResult> {
  const reservation = await queries.getReservationById(reservationId);
  if (!reservation) {
    return { status: 'unavailable', reason: 'Rezerwacja nie istnieje', amount: 0, canPayManually: false };
  }
  if (!(kwota > 0)) {
    return { status: 'unavailable', reason: 'Kwota dopłaty musi być większa od zera', amount: 0, canPayManually: false };
  }

  const provider = getActiveProvider();
  if (!provider) {
    return {
      status: 'unavailable',
      reason: 'Płatności online są obecnie wyłączone',
      amount: kwota,
      canPayManually: true,
    };
  }

  const latest = await queries.getSettlementByLabel(reservationId, opis);
  if (latest?.status === 'paid' && Number(latest.amount) === kwota) {
    return { status: 'paid' };
  }
  const reusable = latest
    && latest.status === 'pending'
    && latest.redirect_url
    && latest.provider === provider.name
    && Number(latest.amount) === kwota;

  if (reusable) {
    return {
      status: 'ready',
      url: latest.redirect_url,
      sessionId: latest.session_id,
      amount: kwota,
      provider: latest.provider,
      reused: true,
    };
  }

  // Unieważniamy wyłącznie poprzednią wersję tej samej należności — inne
  // dopłaty tej rezerwacji (np. trwające przedłużenie) muszą zostać nietknięte.
  await queries.cancelPendingPayments(reservationId, 'settlement', opis);

  const created = await createPaymentForReservation(reservation, customerIp, {
    kind: 'settlement',
    amount: kwota,
    label: opis,
  });
  if (!created) {
    return {
      status: 'unavailable',
      reason: 'Nie udało się utworzyć płatności online',
      amount: kwota,
      canPayManually: true,
    };
  }

  return {
    status: 'ready',
    url: created.redirectUrl,
    sessionId: created.sessionId,
    amount: kwota,
    provider: provider.name,
    reused: false,
  };
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

    const reservation = await queries.getReservationById(Number(reservationId));
    // Email must match the reservation (no resource enumeration)
    if (!reservation || reservation.email.toLowerCase() !== String(email).toLowerCase()) {
      res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
      return;
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || '127.0.0.1';

    const link = await resolvePaymentLink(Number(reservationId), clientIp);
    if (link.status === 'paid') {
      res.status(409).json({ success: false, message: 'Ta rezerwacja jest już opłacona' });
      return;
    }
    if (link.status === 'unavailable') {
      res.status(409).json({ success: false, message: link.reason });
      return;
    }

    res.status(201).json({ success: true, redirectUrl: link.url, sessionId: link.sessionId });
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

      // Aneks wiąże Strony dopiero po zaksięgowaniu wpłaty (§5 ust. 3 umowy).
      if (result.status === 'paid') {
        const { aktywujPrzedluzenie } = await import('../rental-extensions.js');
        const aktywowany = await aktywujPrzedluzenie(result.sessionId).catch((err) => {
          console.error('Nie udało się aktywować przedłużenia:', err);
          return null;
        });
        if (aktywowany) {
          console.log(`📄 Aneks ${aktywowany.extension.number} wszedł w życie`);
          const { sendRentalTermChangedEmail } = await import('../email.js');
          const { reservationProductNames } = await import('../products.js');
          await sendRentalTermChangedEmail(
            {
              email: aktywowany.reservation.email,
              name: aktywowany.reservation.name,
              productName: reservationProductNames(aktywowany.reservation),
              endDate: String(aktywowany.reservation.end_date).slice(0, 10),
              totalPrice: Number(aktywowany.reservation.total_price),
              priceDelta: Number(aktywowany.extension.surcharge),
              note: `Aneks ${aktywowany.extension.number} — przedłużenie opłacone`,
            },
            aktywowany.pdf
              ? {
                  filename: `aneks-${aktywowany.extension.number.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
                  content: aktywowany.pdf.buffer,
                }
              : undefined
          ).catch((err) => console.error('Mail o przedłużeniu:', err));
        }
      }
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
