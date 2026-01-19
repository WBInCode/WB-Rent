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
  // Odkurzacze piorące
  'puzzi-10-1': { name: 'Odkurzacz Piorący Kärcher Puzzi 10/1', pricePerDay: 45, categoryId: 'odkurzacze-piorace' },
  'puzzi-8-1': { name: 'Odkurzacz Piorący Kärcher Puzzi 8/1 Anniversary', pricePerDay: 40, categoryId: 'odkurzacze-piorace' },
  // Odkurzacze przemysłowe
  'nt-22-1': { name: 'Odkurzacz Przemysłowy Kärcher NT 22/1 AP L', pricePerDay: 60, categoryId: 'odkurzacze-przemyslowe' },
  'nt-30-1': { name: 'Odkurzacz Przemysłowy Kärcher NT 30/1 Tact Te L', pricePerDay: 80, categoryId: 'odkurzacze-przemyslowe' },
  'ad-4-premium': { name: 'Odkurzacz Kominkowy Kärcher AD 4 Premium', pricePerDay: 40, categoryId: 'odkurzacze-przemyslowe' },
  // Ozonatory i oczyszczacze
  'ozonmed-pro-10g': { name: 'Ozonator powietrza Ozonmed Pro 10G', pricePerDay: 25, categoryId: 'ozonatory' },
  'af-100-h13': { name: 'Oczyszczacz Powietrza Kärcher AF 100 H13', pricePerDay: 60, categoryId: 'ozonatory' },
  // Pozostały sprzęt
  'dmuchawa-ab-20': { name: 'Dmuchawa Kärcher AB 20 Ec', pricePerDay: 30, categoryId: 'pozostale' },
  'sg-4-4': { name: 'Parownica Kärcher SG 4/4', pricePerDay: 65, categoryId: 'pozostale' },
  'es-1-7-bp': { name: 'System do dezynfekcji Kärcher ES 1/7 Bp Pack', pricePerDay: 25, categoryId: 'pozostale' },
  'wvp-10-adv': { name: 'Myjka Do Okien Kärcher WVP 10 Adv', pricePerDay: 30, categoryId: 'pozostale' },
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
  return error.issues.map((err) => ({
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

    // Send confirmation email to customer only (admin sees in panel)
    sendContactConfirmation(data)
      .catch((err) => console.error('Email error:', err));

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

    // Calculate pricing from client-sent values (server validates)
    const days = data.days;
    const basePrice = days * product.pricePerDay;
    const deliveryFee = data.delivery ? DELIVERY_FEE : 0;
    const weekendPickupFee = data.weekendPickup ? 30 : 0;
    const totalPrice = basePrice + deliveryFee + weekendPickupFee;

    // Full name for database
    const fullName = `${data.firstName} ${data.lastName}`;

    // Save to database
    const queries = getQueries();
    const result = queries.insertReservation.run({
      categoryId: data.categoryId,
      productId: data.productId,
      startDate: data.startDate,
      endDate: data.endDate,
      city: data.city || 'Nie podano',
      delivery: data.delivery ? 1 : 0,
      address: data.address || null,
      name: fullName,
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
      name: fullName,
      days,
      basePrice,
      deliveryFee,
      totalPrice,
      productName: data.productName,
    };

    // Send emails (async, don't wait)
    // Customer gets "waiting for confirmation", Admin gets notification
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

// === GET /api/health ===
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// === GET /api/availability/:productId ===
// Check date availability for a product
router.get('/availability/:productId', (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Wymagane parametry: startDate, endDate',
      });
      return;
    }

    const queries = getQueries();
    
    // Check for conflicting reservations
    // Two date ranges overlap if: startA < endB AND endA > startB
    const conflicts = queries.checkDateAvailability.all({
      productId,
      startDate,
      endDate,
    }) as any[];

    if (conflicts.length > 0) {
      res.json({
        success: true,
        available: false,
        message: 'Produkt jest już zarezerwowany w tym terminie',
        conflicts: conflicts.map(c => ({
          startDate: c.start_date,
          endDate: c.end_date,
          status: c.status,
        })),
      });
    } else {
      res.json({
        success: true,
        available: true,
        message: 'Termin dostępny',
      });
    }
  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd sprawdzania dostępności',
    });
  }
});

// === GET /api/reservations/:productId ===
// Get all reservations for a product (for calendar view)
router.get('/reservations/:productId', (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const queries = getQueries();
    
    const reservations = queries.getReservationsByProduct.all(productId) as any[];
    
    // Return only dates and status (no personal info)
    const dates = reservations.map(r => ({
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.status,
    }));

    res.json({
      success: true,
      data: dates,
    });
  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd pobierania rezerwacji',
    });
  }
});

export default router;
