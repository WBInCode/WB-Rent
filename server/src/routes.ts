import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { contactSchema, reservationSchema, newsletterSubscribeSchema, productNotificationSchema } from './schemas.js';
import { queries } from './db.js';
import {
  sendContactConfirmation,
  sendReservationConfirmation,
  sendReservationNotification,
} from './email.js';

// Product data
const products: Record<string, { name: string; pricePerDay: number; categoryId: string }> = {
  'puzzi-10-1': { name: 'Odkurzacz Piorący Kärcher Puzzi 10/1', pricePerDay: 45, categoryId: 'odkurzacze-piorace' },
  'puzzi-8-1': { name: 'Odkurzacz Piorący Kärcher Puzzi 8/1 Anniversary', pricePerDay: 40, categoryId: 'odkurzacze-piorace' },
  'nt-22-1': { name: 'Odkurzacz Przemysłowy Kärcher NT 22/1 AP L', pricePerDay: 60, categoryId: 'odkurzacze-przemyslowe' },
  'nt-30-1': { name: 'Odkurzacz Przemysłowy Kärcher NT 30/1 Tact Te L', pricePerDay: 80, categoryId: 'odkurzacze-przemyslowe' },
  'ad-4-premium': { name: 'Odkurzacz Kominkowy Kärcher AD 4 Premium', pricePerDay: 40, categoryId: 'odkurzacze-przemyslowe' },
  'ozonmed-pro-10g': { name: 'Ozonator powietrza Ozonmed Pro 10G', pricePerDay: 25, categoryId: 'ozonatory' },
  'af-100-h13': { name: 'Oczyszczacz Powietrza Kärcher AF 100 H13', pricePerDay: 60, categoryId: 'ozonatory' },
  'dmuchawa-ab-20': { name: 'Dmuchawa Kärcher AB 20 Ec', pricePerDay: 30, categoryId: 'pozostale' },
  'sg-4-4': { name: 'Parownica Kärcher SG 4/4', pricePerDay: 65, categoryId: 'pozostale' },
  'es-1-7-bp': { name: 'System do dezynfekcji Kärcher ES 1/7 Bp Pack', pricePerDay: 25, categoryId: 'pozostale' },
  'wvp-10-adv': { name: 'Myjka Do Okien Kärcher WVP 10 Adv', pricePerDay: 30, categoryId: 'pozostale' },
};

const DELIVERY_FEE = 50;

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

    // Check availability
    const conflicts = await queries.checkDateAvailability({
      productId: data.productId,
      startDate: data.startDate,
      endDate: data.endDate,
    });

    if (conflicts.length > 0) {
      const conflictInfo = conflicts.map((c: any) => `${c.start_date} - ${c.end_date}`).join(', ');
      res.status(409).json({
        success: false,
        message: `Produkt jest już zarezerwowany w wybranym terminie (${conflictInfo}). Wybierz inne daty.`,
        errors: [{ field: 'dates', message: 'Termin niedostępny' }],
      });
      return;
    }

    const days = data.days;
    const basePrice = days * product.pricePerDay;
    const deliveryFee = data.delivery ? DELIVERY_FEE : 0;
    const weekendPickupFee = data.weekendPickup ? 30 : 0;
    const totalPrice = basePrice + deliveryFee + weekendPickupFee;

    const fullName = `${data.firstName} ${data.lastName}`;

    const result = await queries.insertReservation({
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

    const emailData = {
      ...data,
      name: fullName,
      days,
      basePrice,
      deliveryFee,
      totalPrice,
      productName: data.productName,
      startTime: data.startTime,
      endTime: data.endTime,
    };

    Promise.all([
      sendReservationConfirmation(emailData),
      sendReservationNotification(emailData),
    ]).catch((err) => console.error('Email error:', err));

    res.status(201).json({
      success: true,
      message: 'Rezerwacja złożona! Otrzymasz potwierdzenie na email w ciągu 24h.',
      id: result.lastInsertRowid,
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

// === POST /api/newsletter/unsubscribe ===
router.post('/newsletter/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Podaj adres email',
      });
      return;
    }

    const existing = await queries.getSubscriberByEmail(email);

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Ten adres email nie jest zapisany do newslettera.',
      });
      return;
    }

    await queries.unsubscribe(email);

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

// === Health check ===
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;
