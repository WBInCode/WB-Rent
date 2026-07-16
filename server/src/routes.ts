import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { contactSchema, reservationSchema, newsletterSubscribeSchema, productNotificationSchema } from './schemas.js';
import { queries } from './db.js';
import { products, calculateProductRentalPrice, DELIVERY_FEE, WEEKEND_PICKUP_FEE } from './products.js';
import { verifyUnsubscribeToken, issueCustomerToken, verifyCustomerToken } from './auth.js';
import { config } from './config.js';
import { createPaymentForReservation } from './payments/routes.js';
import {
  sendContactConfirmation,
  sendReservationConfirmation,
  sendReservationNotification,
  sendMyReservationsLink,
} from './email.js';

// Anti-abuse: magic-link requests are email-sending - keep them rare per IP
const myReservationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Zbyt wiele próśb o link. Spróbuj ponownie za 15 minut.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

const getClientIp = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
    || req.socket.remoteAddress 
    || 'unknown';
};

const formatZodErrors = (error: ZodError) => {
  return error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
};

// === POST /api/contact ===
router.post('/contact', async (req: Request, res: Response) => {
  try {
    const data = contactSchema.parse(req.body);

    if (data.website && data.website.length > 0) {
      console.log('🕷️ Honeypot triggered');
      res.status(200).json({ success: true, message: 'Wiadomość wysłana!' });
      return;
    }

    const result = await queries.insertContact({
      name: data.name,
      email: data.email,
      subject: data.subject || undefined,
      message: data.message,
      honeypot: data.website || undefined,
      ipAddress: getClientIp(req),
    });

    sendContactConfirmation(data).catch((err) => console.error('Email error:', err));

    res.status(201).json({
      success: true,
      message: 'Dziękujemy za wiadomość! Odpowiemy najszybciej jak to możliwe.',
      id: result.lastInsertRowid,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: 'Błąd walidacji',
        errors: formatZodErrors(error),
      });
      return;
    }

    console.error('Contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Wystąpił błąd serwera. Spróbuj ponownie później.',
    });
  }
});

// === POST /api/reservations ===
router.post('/reservations', async (req: Request, res: Response) => {
  try {
    const data = reservationSchema.parse(req.body);

    const product = products[data.productId];
    if (!product) {
      res.status(400).json({
        success: false,
        message: 'Nieprawidłowy produkt',
        errors: [{ field: 'productId', message: 'Wybrany produkt nie istnieje' }],
      });
      return;
    }

    // Recompute rental days server-side (client value is not trusted for pricing).
    // Same rule as the frontend: date difference, +1 day when return time is later
    // than pickup time (started doba), minimum 1.
    const msPerDay = 24 * 60 * 60 * 1000;
    const dateDiff = Math.round(
      (Date.parse(data.endDate) - Date.parse(data.startDate)) / msPerDay
    );
    const [sh, sm] = data.startTime.split(':').map(Number);
    const [eh, em] = data.endTime.split(':').map(Number);
    const extraDay = eh * 60 + em > sh * 60 + sm ? 1 : 0;
    const days = Math.max(1, dateDiff + extraDay);

    const pickupDay = new Date(`${data.startDate}T12:00:00`).getDay();
    const isWeekendPackage = pickupDay === 5 && days <= 3;
    const basePrice = calculateProductRentalPrice(data.productId, days, isWeekendPackage)!;
    const deliveryFee = data.delivery ? DELIVERY_FEE : 0;
    const weekendPickupFee = pickupDay === 0 || pickupDay === 6 ? WEEKEND_PICKUP_FEE : 0;
    const totalPrice = basePrice + deliveryFee + weekendPickupFee;

    const fullName = `${data.firstName} ${data.lastName}`;

    // Atomic availability check + insert (advisory lock per product, no double-booking race)
    const result = await queries.createReservationIfAvailable({
      categoryId: data.categoryId,
      productId: data.productId,
      startDate: data.startDate,
      endDate: data.endDate,
      startTime: data.startTime,
      endTime: data.endTime,
      city: data.city || 'Nie podano',
      delivery: data.delivery ? 1 : 0,
      address: data.address || undefined,
      name: fullName,
      email: data.email,
      phone: data.phone,
      company: data.company || undefined,
      notes: data.notes || undefined,
      wantsInvoice: data.wantsInvoice ? 1 : 0,
      invoiceNip: data.invoiceNip || undefined,
      invoiceCompany: data.invoiceCompany || undefined,
      invoiceAddress: data.invoiceAddress || undefined,
      days,
      basePrice,
      deliveryFee,
      totalPrice,
      ipAddress: getClientIp(req),
    });

    if (result.conflicts) {
      const conflictInfo = result.conflicts.map((c: any) => `${c.start_date} - ${c.end_date}`).join(', ');
      res.status(409).json({
        success: false,
        message: `Produkt jest już zarezerwowany w wybranym terminie (${conflictInfo}). Wybierz inne daty.`,
        errors: [{ field: 'dates', message: 'Termin niedostępny' }],
      });
      return;
    }

    const emailData = {
      ...data,
      name: fullName,
      days,
      basePrice,
      deliveryFee,
      totalPrice,
      productName: product.name,
      startTime: data.startTime,
      endTime: data.endTime,
    };

    Promise.all([
      sendReservationConfirmation(emailData),
      sendReservationNotification(emailData),
    ]).catch((err) => console.error('Email error:', err));

    // Create online payment only when contracts are not required. In the
    // assisted rental flow payment is created immediately after signature.
    let payment: { redirectUrl: string; sessionId: string } | null = null;
    if (!config.contracts.enabled || !config.contracts.requireBeforePayment) {
      try {
        payment = await createPaymentForReservation(
          {
            id: Number(result.lastInsertRowid),
            product_id: data.productId,
            email: data.email,
            total_price: totalPrice,
          },
          getClientIp(req)
        );
      } catch (paymentError) {
        console.error('Payment create error (fallback to offline):', paymentError);
      }
    }

    res.status(201).json({
      success: true,
      message: payment
        ? 'Rezerwacja złożona! Za chwilę przekierujemy Cię do płatności.'
        : config.contracts.enabled && config.contracts.requireBeforePayment
          ? 'Rezerwacja złożona! Płatność zostanie uruchomiona po podpisaniu umowy przy wydaniu sprzętu.'
          : 'Rezerwacja złożona! Otrzymasz potwierdzenie na email w ciągu 24h.',
      id: result.lastInsertRowid,
      payment,
      summary: {
        productName: product.name,
        days,
        basePrice,
        deliveryFee,
        totalPrice,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: 'Błąd walidacji',
        errors: formatZodErrors(error),
      });
      return;
    }

    console.error('Reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Wystąpił błąd serwera. Spróbuj ponownie później.',
    });
  }
});

// === GET /api/reservations/check-availability ===
router.get('/reservations/check-availability', async (req: Request, res: Response) => {
  try {
    const { productId, startDate, endDate } = req.query;

    if (!productId || !startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Podaj productId, startDate i endDate',
      });
      return;
    }

    const conflicts = await queries.checkDateAvailability({
      productId: productId as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    res.json({
      success: true,
      available: conflicts.length === 0,
      conflicts: conflicts.map((c: any) => ({
        startDate: c.start_date,
        endDate: c.end_date,
        status: c.status,
      })),
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd serwera',
    });
  }
});

// === GET /api/reservations/product/:productId ===
router.get('/reservations/product/:productId', async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId as string;
    const reservations = await queries.getReservationsByProduct(productId);

    const blockedDates = reservations.map((r: any) => ({
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.status,
    }));

    res.json({
      success: true,
      productId,
      blockedDates,
    });
  } catch (error) {
    console.error('Get product reservations error:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd serwera',
    });
  }
});

// === GET /api/products/reserved-today ===
router.get('/products/reserved-today', async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const reserved = await queries.getReservedProductsToday(today);

    res.json({
      success: true,
      reservedProducts: reserved.map((r: any) => r.product_id),
    });
  } catch (error) {
    console.error('Get reserved products error:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd serwera',
    });
  }
});

// === GET /api/products/availability ===
// Today's availability map for all products (consumed by frontend product cards)
router.get('/products/availability', async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const reserved = await queries.getReservedProductsToday(today);
    const reservedIds = new Set(reserved.map((r: any) => r.product_id));

    const availability: Record<string, boolean> = {};
    for (const productId of Object.keys(products)) {
      availability[productId] = !reservedIds.has(productId);
    }

    res.json({
      success: true,
      date: today,
      availability,
      reservedCount: reservedIds.size,
      totalProducts: Object.keys(products).length,
    });
  } catch (error) {
    console.error('Get products availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd serwera',
    });
  }
});

// === POST /api/newsletter/subscribe ===
router.post('/newsletter/subscribe', async (req: Request, res: Response) => {
  try {
    const data = newsletterSubscribeSchema.parse(req.body);

    const existing = await queries.getSubscriberByEmail(data.email);

    if (existing) {
      if (existing.status === 'active') {
        res.status(409).json({
          success: false,
          message: 'Ten adres email jest już zapisany do newslettera.',
        });
        return;
      } else {
        await queries.resubscribe(data.email);
        res.json({
          success: true,
          message: 'Witaj ponownie! Twoja subskrypcja została wznowiona.',
        });
        return;
      }
    }

    await queries.insertSubscriber({
      email: data.email,
      name: data.name || undefined,
    });

    res.status(201).json({
      success: true,
      message: 'Dziękujemy za zapisanie się do newslettera!',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: 'Błąd walidacji',
        errors: formatZodErrors(error),
      });
      return;
    }

    console.error('Newsletter subscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Wystąpił błąd. Spróbuj ponownie później.',
    });
  }
});

// === GET /api/newsletter/unsubscribe (link from email, HMAC-signed) ===
router.get('/newsletter/unsubscribe', async (req: Request, res: Response) => {
  const email = String(req.query.email || '');
  const token = String(req.query.token || '');

  const page = (title: string, message: string) => `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} - WB-Rent</title></head>
<body style="margin:0;background:#0a0a0a;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="max-width:480px;padding:40px;text-align:center;">
<h1 style="color:#b8972a;font-size:1.6rem;">${title}</h1>
<p style="color:#a1a1aa;line-height:1.6;">${message}</p>
<a href="${config.siteUrl}" style="display:inline-block;margin-top:20px;background:#b8972a;color:#000;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Wróć na stronę</a>
</div></body></html>`;

  try {
    if (!email || !token || !verifyUnsubscribeToken(email, token)) {
      res.status(400).send(page('Nieprawidłowy link', 'Link wypisu jest nieprawidłowy lub niekompletny. Użyj linku z otrzymanej wiadomości e-mail.'));
      return;
    }

    const existing = await queries.getSubscriberByEmail(email);
    if (existing && existing.status === 'active') {
      await queries.unsubscribe(email);
    }

    // Same response whether subscribed or not (no email enumeration)
    res.send(page('Wypisano z newslettera', 'Twój adres nie będzie już otrzymywał wiadomości od WB-Rent. Przykro nam, że odchodzisz!'));
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).send(page('Błąd', 'Wystąpił błąd. Spróbuj ponownie później.'));
  }
});

// === POST /api/newsletter/unsubscribe (requires HMAC token) ===
router.post('/newsletter/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { email, token } = req.body;

    if (!email || !token || !verifyUnsubscribeToken(String(email), String(token))) {
      res.status(400).json({
        success: false,
        message: 'Nieprawidłowy link wypisu. Użyj linku z wiadomości e-mail.',
      });
      return;
    }

    const existing = await queries.getSubscriberByEmail(email);
    if (existing && existing.status === 'active') {
      await queries.unsubscribe(email);
    }

    // Same response whether subscribed or not (no email enumeration)
    res.json({
      success: true,
      message: 'Zostałeś wypisany z newslettera.',
    });
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Wystąpił błąd. Spróbuj ponownie później.',
    });
  }
});

// === POST /api/notifications/product ===
router.post('/notifications/product', async (req: Request, res: Response) => {
  try {
    const data = productNotificationSchema.parse(req.body);

    const product = products[data.productId];
    if (!product) {
      res.status(400).json({
        success: false,
        message: 'Nieprawidłowy produkt',
      });
      return;
    }

    await queries.insertProductNotification({
      productId: data.productId,
      email: data.email,
    });

    res.status(201).json({
      success: true,
      message: `Powiadomimy Cię gdy ${product.name} będzie dostępny.`,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: 'Błąd walidacji',
        errors: formatZodErrors(error),
      });
      return;
    }

    console.error('Product notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Wystąpił błąd. Spróbuj ponownie później.',
    });
  }
});

// === MOJE REZERWACJE (magic-link, bez rejestracji) ===

// Request an access link (always 200 - no email enumeration)
router.post('/my-reservations/request-link', myReservationsLimiter, async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      res.status(400).json({ success: false, message: 'Podaj poprawny adres e-mail' });
      return;
    }

    const reservations = await queries.getReservationsByEmail(email);
    if (reservations.length > 0) {
      const { token } = issueCustomerToken(email);
      const link = `${config.siteUrl}/moje-rezerwacje?token=${encodeURIComponent(token)}`;
      sendMyReservationsLink(email, link).catch((err) => console.error('Magic link email error:', err));
    }

    // Identical response whether the email has reservations or not
    res.json({
      success: true,
      message: 'Jeśli ten adres ma rezerwacje, wysłaliśmy na niego link dostępu (ważny 24h).',
    });
  } catch (error) {
    console.error('Request link error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// List reservations for the token's email (per-resource authorization)
router.get('/my-reservations', async (req: Request, res: Response) => {
  try {
    const email = verifyCustomerToken(String(req.query.token || ''));
    if (!email) {
      res.status(401).json({ success: false, message: 'Link wygasł lub jest nieprawidłowy. Poproś o nowy.' });
      return;
    }

    const reservations = await queries.getReservationsByEmail(email);
    res.json({
      success: true,
      email,
      data: reservations.map((r: any) => ({
        ...r,
        productName: products[r.product_id]?.name || r.product_id,
      })),
    });
  } catch (error) {
    console.error('My reservations error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Cancel own reservation (only pending/confirmed, only before start date)
router.post('/my-reservations/:id/cancel', async (req: Request, res: Response) => {
  try {
    const email = verifyCustomerToken(String(req.body?.token || ''));
    if (!email) {
      res.status(401).json({ success: false, message: 'Link wygasł lub jest nieprawidłowy. Poproś o nowy.' });
      return;
    }

    const reservation = await queries.getReservationById(Number(req.params.id));
    // Per-resource check: the reservation must belong to the token's email
    if (!reservation || reservation.email.toLowerCase() !== email.toLowerCase()) {
      res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
      return;
    }

    if (!['pending', 'confirmed'].includes(reservation.status)) {
      res.status(409).json({ success: false, message: 'Tej rezerwacji nie można już anulować' });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (String(reservation.start_date) <= today) {
      res.status(409).json({ success: false, message: 'Rezerwacji nie można anulować w dniu rozpoczęcia — skontaktuj się z nami telefonicznie' });
      return;
    }

    await queries.updateReservationStatus({ id: reservation.id, status: 'cancelled' });

    res.json({ success: true, message: 'Rezerwacja anulowana' });
  } catch (error) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// === Health check ===
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;
