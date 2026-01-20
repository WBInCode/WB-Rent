import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { contactSchema, reservationSchema, newsletterSubscribeSchema, productNotificationSchema } from './schemas.js';
import { getQueries } from './db.js';
import {
  sendContactConfirmation,
  // sendContactNotification - sent from admin panel
  sendReservationConfirmation,
  sendReservationNotification,
  // sendProductAvailabilityNotification - sent from admin panel
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

    const queries = getQueries();

    // === SERVER-SIDE AVAILABILITY CHECK ===
    // Check for conflicting reservations before creating new one
    const conflicts = queries.checkDateAvailability.all({
      productId: data.productId,
      startDate: data.startDate,
      endDate: data.endDate,
    }) as any[];

    if (conflicts.length > 0) {
      const conflictInfo = conflicts.map(c => `${c.start_date} - ${c.end_date}`).join(', ');
      res.status(409).json({
        success: false,
        message: `Produkt jest już zarezerwowany w wybranym terminie (${conflictInfo}). Wybierz inne daty.`,
        errors: [{ field: 'dates', message: 'Termin niedostępny' }],
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
      wantsInvoice: data.wantsInvoice ? 1 : 0,
      invoiceNip: data.invoiceNip || null,
      invoiceCompany: data.invoiceCompany || null,
      invoiceAddress: data.invoiceAddress || null,
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

// === POST /api/notify-availability ===
// Customer wants to be notified when product becomes available
router.post('/notify-availability', async (req: Request, res: Response) => {
  try {
    const data = productNotificationSchema.parse(req.body);
    const queries = getQueries();

    // Check if product exists
    if (!products[data.productId]) {
      res.status(400).json({
        success: false,
        message: 'Produkt nie istnieje',
      });
      return;
    }

    // Save notification request
    queries.insertProductNotification.run({
      productId: data.productId,
      email: data.email,
    });

    res.status(201).json({
      success: true,
      message: 'Zapisano! Powiadomimy Cię gdy produkt będzie dostępny.',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: 'Nieprawidłowe dane',
        errors: error.issues.map(e => ({ field: e.path.join('.'), message: e.message })),
      });
      return;
    }
    console.error('Notification signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Wystąpił błąd serwera',
    });
  }
});

// === POST /api/newsletter/subscribe ===
router.post('/newsletter/subscribe', async (req: Request, res: Response) => {
  try {
    const data = newsletterSubscribeSchema.parse(req.body);
    const queries = getQueries();

    // Check if already subscribed
    const existing = queries.getSubscriberByEmail.get(data.email) as any;
    
    if (existing) {
      if (existing.status === 'active') {
        res.status(200).json({
          success: true,
          message: 'Jesteś już zapisany do naszego newslettera!',
        });
        return;
      } else {
        // Resubscribe
        queries.resubscribe.run(data.email);
        res.status(200).json({
          success: true,
          message: 'Witamy ponownie! Zostałeś ponownie zapisany do newslettera.',
        });
        return;
      }
    }

    // Insert new subscriber
    queries.insertSubscriber.run({
      email: data.email,
      name: data.name || null,
    });

    res.status(201).json({
      success: true,
      message: 'Dziękujemy za zapisanie się do newslettera! Będziemy informować Cię o nowościach.',
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

    // Handle unique constraint violation
    if ((error as any)?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(200).json({
        success: true,
        message: 'Jesteś już zapisany do naszego newslettera!',
      });
      return;
    }

    console.error('Newsletter subscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Wystąpił błąd serwera. Spróbuj ponownie później.',
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

    const queries = getQueries();
    queries.unsubscribe.run(email);

    res.status(200).json({
      success: true,
      message: 'Zostałeś wypisany z newslettera.',
    });
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Wystąpił błąd serwera.',
    });
  }
});

// === GET /api/products/availability ===
// Get today's availability for all products
router.get('/products/availability', (_req: Request, res: Response) => {
  try {
    const queries = getQueries();
    
    // Get today's date in YYYY-MM-DD format (local timezone)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    // Get all products that are currently reserved
    const reserved = queries.getReservedProductsToday.all({ today: todayStr }) as { product_id: string }[];
    const reservedIds = new Set(reserved.map(r => r.product_id));
    
    // Build availability map for all products
    const availability: Record<string, boolean> = {};
    for (const productId of Object.keys(products)) {
      availability[productId] = !reservedIds.has(productId);
    }
    
    res.json({
      success: true,
      date: todayStr,
      availability,
      reservedCount: reservedIds.size,
      totalProducts: Object.keys(products).length,
    });
  } catch (error) {
    console.error('Products availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd pobierania dostępności',
    });
  }
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

// === GET /api/newsletter/unsubscribe ===
// Unsubscribe via link in email
router.get('/newsletter/unsubscribe', (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    
    if (!email || typeof email !== 'string') {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Błąd - WB-Rent</title></head>
        <body style="font-family: Arial, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
          <div style="text-align: center; padding: 40px;">
            <h1 style="color: #ef4444;">Błąd</h1>
            <p>Nieprawidłowy link do wypisania.</p>
            <a href="https://wbrent.pl" style="color: #b8972a;">Wróć na stronę główną</a>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const queries = getQueries();
    queries.unsubscribe.run(email);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Wypisano z newslettera - WB-Rent</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: Arial, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
        <div style="text-align: center; padding: 40px; max-width: 500px;">
          <div style="width: 80px; height: 80px; background: #22c55e20; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
              <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
          </div>
          <h1 style="color: #b8972a; margin-bottom: 16px;">Wypisano z newslettera</h1>
          <p style="color: #a1a1aa; margin-bottom: 24px;">
            Twój adres <strong style="color: #fff;">${email}</strong> został usunięty z listy mailingowej WB-Rent.
          </p>
          <p style="color: #71717a; font-size: 14px; margin-bottom: 24px;">
            Jeśli zmienisz zdanie, zawsze możesz zapisać się ponownie na naszej stronie.
          </p>
          <a href="https://wbrent.pl" style="display: inline-block; background: linear-gradient(135deg, #b8972a 0%, #8b7420 100%); color: #000; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Wróć na stronę główną
          </a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Błąd - WB-Rent</title></head>
      <body style="font-family: Arial, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
        <div style="text-align: center; padding: 40px;">
          <h1 style="color: #ef4444;">Wystąpił błąd</h1>
          <p>Spróbuj ponownie później.</p>
          <a href="https://wbrent.pl" style="color: #b8972a;">Wróć na stronę główną</a>
        </div>
      </body>
      </html>
    `);
  }
});

export default router;
