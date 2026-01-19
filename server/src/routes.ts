import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { contactSchema, reservationSchema } from './schemas.js';
import { getQueries } from './db.js';
import {
  sendContactConfirmation,
  sendContactNotification,
  sendReservationConfirmation,
  sendReservationNotification,
} from './email.js';

// Product data (should match frontend)
const products: Record<string, { name: string; pricePerDay: number; categoryId: string }> = {
  'ozonator-20g': { name: 'Ozonator profesjonalny 20g/h', pricePerDay: 120, categoryId: 'ozonatory' },
  'ozonator-10g': { name: 'Ozonator kompaktowy 10g/h', pricePerDay: 80, categoryId: 'ozonatory' },
  'myjka-200bar': { name: 'Myjka ciśnieniowa 200 bar', pricePerDay: 150, categoryId: 'sprzet-czyszczacy' },
  'odkurzacz-przemyslowy': { name: 'Odkurzacz przemysłowy', pricePerDay: 100, categoryId: 'sprzet-czyszczacy' },
  'odkurzacz-pioracy': { name: 'Odkurzacz piorący', pricePerDay: 120, categoryId: 'sprzet-czyszczacy' },
  'polerka-ekstraktor': { name: 'Polerka / Ekstraktor', pricePerDay: 100, categoryId: 'sprzet-czyszczacy' },
};

const DELIVERY_FEE = 50; // PLN

const router = Router();

// Helper: get client IP
const getClientIp = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
    || req.socket.remoteAddress 
    || 'unknown';
};

// Helper: format Zod errors
const formatZodErrors = (error: ZodError) => {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
};

// === POST /api/contact ===
router.post('/contact', async (req: Request, res: Response) => {
  try {
    // Validate
    const data = contactSchema.parse(req.body);

    // Check honeypot (spam protection)
    if (data.website && data.website.length > 0) {
      console.log('🕷️ Honeypot triggered, ignoring spam submission');
      // Return success to not reveal the honeypot
      res.status(200).json({ success: true, message: 'Wiadomość wysłana!' });
      return;
    }

    // Save to database
    const queries = getQueries();
    const result = queries.insertContact.run({
      name: data.name,
      email: data.email,
      subject: data.subject || null,
      message: data.message,
      honeypot: data.website || null,
      ipAddress: getClientIp(req),
    });

    // Send emails (async, don't wait)
    Promise.all([
      sendContactConfirmation(data),
      sendContactNotification(data),
    ]).catch((err) => console.error('Email error:', err));

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
    // Validate
    const data = reservationSchema.parse(req.body);

    // Get product info
    const product = products[data.productId];
    if (!product) {
      res.status(400).json({
        success: false,
        message: 'Nieprawidłowy produkt',
        errors: [{ field: 'productId', message: 'Wybrany produkt nie istnieje' }],
      });
      return;
    }

    // Calculate pricing
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const basePrice = days * product.pricePerDay;
    const deliveryFee = data.delivery ? DELIVERY_FEE : 0;
    const totalPrice = basePrice + deliveryFee;

    // Save to database
    const queries = getQueries();
    const result = queries.insertReservation.run({
      categoryId: data.categoryId,
      productId: data.productId,
      startDate: data.startDate,
      endDate: data.endDate,
      city: data.city,
      delivery: data.delivery ? 1 : 0,
      address: data.address || null,
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company || null,
      notes: data.notes || null,
      days,
      basePrice,
      deliveryFee,
      totalPrice,
      ipAddress: getClientIp(req),
    });

    // Prepare email data
    const emailData = {
      ...data,
      days,
      basePrice,
      deliveryFee,
      totalPrice,
      productName: product.name,
    };

    // Send emails (async, don't wait)
    Promise.all([
      sendReservationConfirmation(emailData),
      sendReservationNotification(emailData),
    ]).catch((err) => console.error('Email error:', err));

    res.status(201).json({
      success: true,
      message: 'Rezerwacja przyjęta! Skontaktujemy się w ciągu 24h.',
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

// === GET /api/health ===
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
