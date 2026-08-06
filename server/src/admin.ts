import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z, ZodError } from 'zod';
import { queries } from './db.js';
import { config } from './config.js';
import { verifyPassword, verifyScryptHash, hashPassword, issueToken, verifyToken } from './auth.js';
import { sendContactReply, sendReservationStatusEmail, sendPickedUpEmail, sendReturnedEmail, sendRentalTermChangedEmail, sendNewsletterEmail, sendProductAvailabilityNotification, sendCouponEmail, sendPaymentLinkEmail } from './email.js';
import { calculateRentalItemsPrice, getProductName, products } from './products.js';
import {
  newsletterPostSchema,
  productInventorySchema,
  documentMetadataSchema,
  discountSchema,
  couponCreateSchema,
  businessSettingsSchema,
} from './schemas.js';
import { buildDefaultHandoverItems, contractDetailsSchema, createContractSchema, createContractSession, readSignedContractPdfById, regenerateSignedContractPdf, resendSignedContractEmail } from './contracts/service.js';
import { getOrCreateHandoverDraft, saveHandoverDraft, signHandoverProtocol, readHandoverPdf } from './contracts/protocol-service.js';
import { deleteProductImage, productImageUpload, saveProductImage } from './product-images.js';
import { resolvePaymentLink } from './payments/routes.js';
import { describeRentalStage } from './reservation-stage.js';
import { availableActions, canPrepareHandover, canTransition } from './reservation-transitions.js';
import { deleteDocumentFile, documentUpload, photoUpload, readDocumentFile, saveDocumentFile, savePhotoFile } from './documents.js';
import { formatCouponValue, generateCouponCode, generateCouponPdf } from './coupons.js';

const router = Router();

const BUSINESS_SETTINGS_KEY = 'business_settings';

/** Stored settings merged over schema defaults, so new options appear without a migration. */
const loadBusinessSettings = async () => {
  const raw = await queries.getSetting(BUSINESS_SETTINGS_KEY);
  let stored: unknown = {};
  if (raw) {
    try {
      stored = JSON.parse(raw);
    } catch {
      stored = {};
    }
  }
  const parsed = businessSettingsSchema.safeParse(stored);
  return parsed.success ? parsed.data : businessSettingsSchema.parse({});
};

const termChangeSchema = z.object({
  endDate: z.string().nullable().optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Nieprawidłowa godzina zwrotu'),
  isIndefinite: z.boolean(),
  note: z.string().trim().min(3, 'Podaj powód lub sposób uzgodnienia zmiany').max(500),
  changedBy: z.string().trim().min(3, 'Podaj pracownika zatwierdzającego zmianę').max(120),
});

const reservationStatuses = ['pending', 'confirmed', 'picked_up', 'returned', 'completed', 'rejected', 'cancelled'] as const;

/** Wpis do historii, gdy pracownik nie dopisze wlasnej notatki. */
const DOMYSLNA_NOTATKA: Record<string, string> = {
  confirmed: 'Rezerwacja potwierdzona',
  picked_up: 'Sprzęt wydany klientowi',
  returned: 'Przyjęto zwrot sprzętu',
  completed: 'Najem zamknięty i rozliczony',
  rejected: 'Rezerwacja odrzucona',
  cancelled: 'Rezerwacja anulowana',
};

const statusChangeSchema = z.object({
  status: z.enum(reservationStatuses),
  note: z.string().trim().max(500).optional(),
  changedBy: z.string().trim().max(120).optional(),
  notifyCustomer: z.boolean().optional(),
});

const reservationProductIds = (reservation: any): string[] => {
  if (Array.isArray(reservation.items) && reservation.items.length > 0) {
    return reservation.items.map((item: any) => String(item.product_id));
  }
  return [String(reservation.product_id)];
};

const reservationProductNames = (reservation: any): string =>
  reservationProductIds(reservation).map(getProductName).join(', ');

// Admin authentication middleware - verifies signed, expiring token
const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Brak autoryzacji' });
    return;
  }

  const token = authHeader.split(' ')[1];
  
  if (!token || !verifyToken(token)) {
    res.status(401).json({ success: false, message: 'Sesja wygasła. Zaloguj się ponownie.' });
    return;
  }

  next();
};

// Brute-force protection for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login endpoint
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { password } = req.body;

  if (typeof password !== 'string') {
    res.status(401).json({ success: false, message: 'Nieprawidłowe hasło' });
    return;
  }

  // DB-stored hash (set via change-password) takes precedence over ENV
  let valid = false;
  try {
    const dbHash = await queries.getSetting('admin_password_hash');
    valid = dbHash ? verifyScryptHash(password, dbHash) : verifyPassword(password);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
    return;
  }

  if (valid) {
    const { token, expiresAt } = issueToken();
    res.json({ 
      success: true, 
      token,
      expiresAt,
      message: 'Zalogowano pomyślnie'
    });
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Nieprawidłowe hasło' 
    });
  }
});

// Change admin password (stores scrypt hash in DB, overrides ENV password)
router.post('/change-password', adminAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ success: false, message: 'Podaj obecne i nowe hasło' });
      return;
    }

    if (newPassword.length < 10) {
      res.status(400).json({ success: false, message: 'Nowe hasło musi mieć co najmniej 10 znaków' });
      return;
    }

    const dbHash = await queries.getSetting('admin_password_hash');
    const currentValid = dbHash ? verifyScryptHash(currentPassword, dbHash) : verifyPassword(currentPassword);
    if (!currentValid) {
      res.status(401).json({ success: false, message: 'Obecne hasło jest nieprawidłowe' });
      return;
    }

    await queries.setSetting('admin_password_hash', hashPassword(newPassword));
    res.json({ success: true, message: 'Hasło zmienione' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// === PRODUCT INVENTORY ===
router.get('/products', adminAuth, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await queries.getProducts(true) });
  } catch (error) {
    console.error('Get admin products error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się pobrać magazynu' });
  }
});

router.post('/products/images', adminAuth, (req: Request, res: Response) => {
  productImageUpload.single('image')(req, res, async (uploadError) => {
    try {
      if (uploadError) {
        const message = uploadError instanceof Error && uploadError.message.includes('File too large')
          ? 'Zdjęcie może mieć maksymalnie 5 MB'
          : 'Nie udało się odczytać zdjęcia';
        res.status(400).json({ success: false, message });
        return;
      }
      if (!req.file?.buffer) {
        res.status(400).json({ success: false, message: 'Wybierz zdjęcie do wysłania' });
        return;
      }
      const url = await saveProductImage(req.file.buffer);
      res.status(201).json({ success: true, data: { url }, message: 'Zdjęcie zostało dodane' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się zapisać zdjęcia';
      res.status(400).json({ success: false, message });
    }
  });
});

router.delete('/products/images/:filename', adminAuth, async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename as string;
    const url = `/api/product-images/${filename}`;
    if (await queries.isProductImageInUse(url)) {
      res.status(409).json({ success: false, message: 'Najpierw usuń zdjęcie z galerii produktu i zapisz zmiany' });
      return;
    }
    await deleteProductImage(filename);
    res.json({ success: true, message: 'Plik zdjęcia został usunięty' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się usunąć zdjęcia';
    res.status(400).json({ success: false, message });
  }
});

router.post('/products', adminAuth, async (req: Request, res: Response) => {
  try {
    const data = productInventorySchema.parse(req.body);
    const product = await queries.createProduct(data);
    res.status(201).json({ success: true, data: product, message: 'Produkt został dodany' });
  } catch (error: any) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message || 'Nieprawidłowe dane produktu' });
      return;
    }
    if (error?.code === '23505') {
      res.status(409).json({ success: false, message: 'Produkt o takim ID już istnieje' });
      return;
    }
    console.error('Create product error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się dodać produktu' });
  }
});

router.put('/products/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const data = productInventorySchema.parse({ ...req.body, id });

    // Stock must never drop below what is already booked, otherwise active
    // reservations point at equipment the system no longer has. The condition
    // flag is deliberately excluded - equipment breaks mid-rental and staff must
    // still be able to mark it; it only blocks new bookings.
    const rentable = Math.max(data.totalQuantity - data.serviceQuantity, 0);
    const booked = await queries.getPeakActiveReservations(id);
    if (rentable < booked) {
      res.status(409).json({
        success: false,
        message: `Nie można zejść poniżej ${booked} szt. — tyle sztuk jest równocześnie zarezerwowanych na przyszłe terminy. Najpierw anuluj lub zakończ te rezerwacje.`,
      });
      return;
    }

    const product = await queries.updateProduct(id, data);
    if (!product) {
      res.status(404).json({ success: false, message: 'Produkt nie istnieje' });
      return;
    }
    res.json({ success: true, data: product, message: 'Produkt został zapisany' });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message || 'Nieprawidłowe dane produktu' });
      return;
    }
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się zapisać produktu' });
  }
});

router.delete('/products/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const deletedProduct = await queries.deleteProduct(req.params.id as string);
    if (!deletedProduct) {
      res.status(409).json({
        success: false,
        message: 'Produktu użytego w rezerwacji nie można usunąć. Ukryj go zamiast tego.',
      });
      return;
    }
    const uploadedImages = Array.isArray(deletedProduct.images)
      ? deletedProduct.images.filter((url: unknown): url is string =>
          typeof url === 'string' && url.startsWith('/api/product-images/'))
      : [];
    await Promise.all(uploadedImages.map((url: string) =>
      deleteProductImage(url.split('/').pop() as string).catch((error) =>
        console.error('Delete orphaned product image error:', error))))
    res.json({ success: true, message: 'Produkt został usunięty' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się usunąć produktu' });
  }
});

// === RENTAL CONTRACTS (employee-assisted kiosk flow) ===
router.get('/contracts/handover-template', adminAuth, (req: Request, res: Response) => {
  const products = String(req.query.products || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 20);
  if (products.length === 0) {
    res.status(400).json({ success: false, message: 'Podaj identyfikatory urządzeń' });
    return;
  }
  res.json({ success: true, data: { items: buildDefaultHandoverItems(products) } });
});

router.post('/contracts/validate', adminAuth, (req: Request, res: Response) => {
  try {
    contractDetailsSchema.parse({
      ...req.body,
      deposit: Number(req.body?.deposit),
    });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: error.issues[0]?.message || 'Sprawdź dane umowy',
        errors: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }
    res.status(400).json({ success: false, message: 'Nieprawidłowe dane umowy' });
  }
});

router.post('/contracts', adminAuth, async (req: Request, res: Response) => {
  try {
    const input = createContractSchema.parse({
      ...req.body,
      reservationId: Number(req.body?.reservationId),
      deposit: Number(req.body?.deposit),
    });
    const session = await createContractSession(input);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: error.issues[0]?.message || 'Sprawdź dane umowy',
        errors: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }
    const message = error instanceof Error ? error.message : 'Nie udało się przygotować umowy';
    res.status(400).json({ success: false, message });
  }
});

router.get('/contracts/reservation/:reservationId', adminAuth, async (req: Request, res: Response) => {
  try {
    const contract = await queries.getContractByReservationId(Number(req.params.reservationId));
    if (!contract) {
      res.status(404).json({ success: false, message: 'Umowa nie została przygotowana' });
      return;
    }
    res.json({
      success: true,
      data: {
        id: contract.id,
        contractNumber: contract.contract_number,
        templateVersion: contract.template_version,
        status: contract.status,
        expiresAt: contract.signing_expires_at,
        signedAt: contract.signed_at,
        pdfHash: contract.pdf_hash,
        emailSentAt: contract.email_sent_at,
      },
    });
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.get('/contracts/:id/pdf', adminAuth, async (req: Request, res: Response) => {
  try {
    const pdf = await readSignedContractPdfById(Number(req.params.id));
    if (!pdf) {
      res.status(404).json({ success: false, message: 'Podpisany dokument nie istnieje' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf.buffer);
  } catch (error) {
    console.error('Admin contract PDF error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.post('/contracts/:id/regenerate-pdf', adminAuth, async (req: Request, res: Response) => {
  try {
    const result = await regenerateSignedContractPdf(
      Number(req.params.id),
      req.body?.resendEmail === true
    );
    res.json({
      success: true,
      message: 'PDF umowy został zregenerowany z oryginalnego snapshotu i podpisu',
      data: { contractNumber: result.contractNumber, pdfHash: result.pdfHash },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się zregenerować PDF';
    res.status(400).json({ success: false, message });
  }
});

router.post('/contracts/:id/resend-email', adminAuth, async (req: Request, res: Response) => {
  try {
    const result = await resendSignedContractEmail(Number(req.params.id));
    if (!result.delivered) {
      const message = result.transport === 'console'
        ? 'E-mail nie został dostarczony: transport pocztowy nie jest skonfigurowany'
        : `E-mail nie został dostarczony: dostawca ${result.transport.toUpperCase()} odrzucił wysyłkę`;
      res.status(503).json({
        success: false,
        message,
        data: result,
      });
      return;
    }
    res.json({
      success: true,
      message: `Umowa ${result.contractNumber} została wysłana ponownie na ${result.email}`,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się wysłać umowy';
    res.status(400).json({ success: false, message });
  }
});

// Get all reservations
router.get('/reservations', adminAuth, async (_req: Request, res: Response) => {
  try {
    const reservations = await queries.getReservations();

    const now = Date.now();
    const idki = reservations.map((r: any) => r.id);
    const zdjeciaZwrotu = await queries.countPhotosForReservations(idki, 'after');
    const zdjeciaWydania = await queries.countPhotosForReservations(idki, 'before');
    const zProtokolem = await queries.signedProtocolsForReservations(idki, 'handover');
    const zEtapem = reservations.map((reservation: any) => {
      const context = {
        returnPhotos: zdjeciaZwrotu[reservation.id] ?? 0,
        handoverPhotos: zdjeciaWydania[reservation.id] ?? 0,
        handoverProtocolSigned: zProtokolem.has(reservation.id),
      };
      return {
        ...reservation,
        stage: describeRentalStage(reservation, now),
        actions: availableActions(reservation, context, now),
        handoverSigned: zProtokolem.has(reservation.id),
        handoverPhotos: context.handoverPhotos,
      };
    });

    res.json({ success: true, data: zEtapem });
  } catch (error) {
    console.error('Admin reservations error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.get('/reservations/:id/term-changes', adminAuth, async (req: Request, res: Response) => {
  const reservation = await queries.getReservationById(Number(req.params.id));
  if (!reservation) {
    res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
    return;
  }
  const changes = await queries.getReservationTermChanges(reservation.id);
  res.json({ success: true, data: changes });
});

// === PROTOKÓŁ WYDANIA (Załącznik nr 1) ===

router.get('/reservations/:id/handover', adminAuth, async (req: Request, res: Response) => {
  try {
    const reservationId = Number(req.params.id);
    const reservation = await queries.getReservationById(reservationId);
    if (!reservation) {
      res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
      return;
    }

    const { protocol, snapshot } = await getOrCreateHandoverDraft(reservationId);
    const przygotowanie = canPrepareHandover(reservation);
    const zdjecia = await queries.countReservationPhotos(reservationId, 'before');
    const akcje = availableActions(
      reservation,
      {
        returnPhotos: await queries.countReservationPhotos(reservationId, 'after'),
        handoverPhotos: zdjecia,
        handoverProtocolSigned: protocol.status === 'signed',
      },
      Date.now()
    );
    const wydanie = akcje.find((akcja) => akcja.action === 'hand_over');

    res.json({
      success: true,
      data: {
        status: protocol.status,
        signedAt: protocol.signed_at,
        snapshot,
        // Odcisk treści, którą zobaczy podpisujący — wraca przy podpisie.
        contentHash: protocol.content_hash,
        customerName: reservation.name,
        photoCount: zdjecia,
        canSign: protocol.status === 'draft' && przygotowanie.ok,
        blockedReason: przygotowanie.ok ? null : przygotowanie.reason,
        // Wydanie to osobny krok: wymaga podpisanego protokołu i zdjęć.
        canRelease: Boolean(wydanie?.available),
        releaseBlockedReason: wydanie?.available ? null : wydanie?.reason ?? null,
        released: reservation.status === 'picked_up',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się otworzyć protokołu wydania';
    console.error('Handover draft error:', error);
    res.status(400).json({ success: false, message });
  }
});

router.post('/reservations/:id/handover', adminAuth, async (req: Request, res: Response) => {
  try {
    const { snapshot, contentHash } = await saveHandoverDraft(Number(req.params.id), req.body);
    res.json({ success: true, data: { snapshot, contentHash }, message: 'Protokół przygotowany do podpisu' });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message || 'Sprawdź dane protokołu' });
      return;
    }
    const message = error instanceof Error ? error.message : 'Nie udało się zapisać protokołu';
    res.status(400).json({ success: false, message });
  }
});

router.post('/reservations/:id/handover/sign', adminAuth, async (req: Request, res: Response) => {
  try {
    const reservationId = Number(req.params.id);
    const reservation = await queries.getReservationById(reservationId);
    if (!reservation) {
      res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
      return;
    }

    if (await queries.hasSignedProtocol(reservationId, 'handover')) {
      res.status(409).json({ success: false, message: 'Protokół wydania został już podpisany' });
      return;
    }

    // Protokół podpisuje się przy wydaniu, więc umowa musi być podpisana i najem
    // opłacony. Samo wydanie ma warunek szerszy — sprawdzany dopiero przy nim.
    const przygotowanie = canPrepareHandover(reservation);
    if (!przygotowanie.ok) {
      res.status(409).json({ success: false, message: przygotowanie.reason });
      return;
    }

    const { staffSignature, renterSignature, contentHash } = req.body ?? {};
    const wynik = await signHandoverProtocol({
      reservationId,
      contentHash: String(contentHash || ''),
      staffSignatureDataUrl: String(staffSignature || ''),
      renterSignatureDataUrl: String(renterSignature || ''),
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1',
      userAgent: String(req.headers['user-agent'] || 'unknown'),
    });

    res.json({
      success: true,
      data: wynik,
      message: wynik.emailDelivered
        ? `Protokół ${wynik.protocolNumber} podpisany i wysłany do klienta. Dodaj zdjęcia i wydaj sprzęt.`
        : `Protokół ${wynik.protocolNumber} podpisany, ale e-mail nie został wysłany. Dodaj zdjęcia i wydaj sprzęt.`,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message || 'Sprawdź dane protokołu' });
      return;
    }
    const message = error instanceof Error ? error.message : 'Nie udało się podpisać protokołu';
    console.error('Handover sign error:', error);
    res.status(400).json({ success: false, message });
  }
});

router.get('/reservations/:id/handover/pdf', adminAuth, async (req: Request, res: Response) => {
  try {
    const plik = await readHandoverPdf(Number(req.params.id));
    if (!plik) {
      res.status(404).json({ success: false, message: 'Podpisany protokół wydania nie istnieje' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${plik.filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(plik.buffer);
  } catch (error) {
    console.error('Handover pdf error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się pobrać protokołu' });
  }
});

// === LINK DO PŁATNOŚCI ===
// Zwraca ten sam link przy kolejnych wywołaniach, żeby klient nie dostał kilku
// otwartych sesji płatności i nie zapłacił dwa razy.
router.get('/reservations/:id/payment-link', adminAuth, async (req: Request, res: Response) => {
  try {
    const link = await resolvePaymentLink(Number(req.params.id), '127.0.0.1');
    res.json({ success: true, data: link });
  } catch (error) {
    console.error('Admin payment link error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się przygotować linku do płatności' });
  }
});

// Wpłata przyjęta przy ladzie. Bez tego wydanie sprzętu blokowałoby się na
// "rezerwacja nieopłacona", mimo że pieniądze są w kasie.
const manualPaymentSchema = z.object({
  method: z.enum(['cash', 'transfer', 'terminal'], { message: 'Wybierz formę wpłaty: gotówka, przelew lub terminal' }),
  amount: z.number({ message: 'Podaj kwotę wpłaty' }).positive('Kwota musi być większa od zera').max(100000),
  confirmedBy: z.string({ message: 'Podaj imię i nazwisko pracownika' }).trim().min(3, 'Podaj imię i nazwisko pracownika').max(120),
});

router.post('/reservations/:id/mark-paid', adminAuth, async (req: Request, res: Response) => {
  try {
    const input = manualPaymentSchema.parse(req.body);
    const reservation = await queries.getReservationById(Number(req.params.id));
    if (!reservation) {
      res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
      return;
    }

    // Ta sama bramka co dla płatności online. Inaczej gotówka omijałaby wymóg
    // podpisanej umowy i pozwalała wydać sprzęt bez dokumentu.
    const link = await resolvePaymentLink(reservation.id, '127.0.0.1');
    if (link.status === 'paid') {
      res.status(409).json({ success: false, message: 'Ta rezerwacja jest już opłacona' });
      return;
    }
    if (link.status === 'unavailable' && !link.canPayManually) {
      res.status(409).json({ success: false, message: link.reason });
      return;
    }

    await queries.recordManualPayment({
      reservationId: reservation.id,
      amount: input.amount,
      method: input.method,
      confirmedBy: input.confirmedBy,
    });

    const nazwa = { cash: 'gotówką', transfer: 'przelewem', terminal: 'terminalem' }[input.method];
    res.json({ success: true, message: `Zapisano wpłatę ${nazwa}. Link online przestał działać.` });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message || 'Nieprawidłowe dane wpłaty' });
      return;
    }
    console.error('Manual payment error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się zapisać wpłaty' });
  }
});

router.post('/reservations/:id/payment-link/send', adminAuth, async (req: Request, res: Response) => {
  try {
    const reservation = await queries.getReservationById(Number(req.params.id));
    if (!reservation) {
      res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
      return;
    }

    const link = await resolvePaymentLink(reservation.id, '127.0.0.1');
    if (link.status === 'paid') {
      res.status(409).json({ success: false, message: 'Ta rezerwacja jest już opłacona' });
      return;
    }
    if (link.status === 'unavailable') {
      res.status(409).json({ success: false, message: link.reason });
      return;
    }

    const result = await sendPaymentLinkEmail(
      reservation.email,
      reservation.name,
      reservation.id,
      link.amount,
      link.url
    );
    if (!result.delivered) {
      res.status(502).json({
        success: false,
        message: 'Link został przygotowany, ale e-mail nie został wysłany. Skopiuj link ręcznie.',
      });
      return;
    }

    res.json({ success: true, message: `Link do płatności wysłany na ${reservation.email}` });
  } catch (error) {
    console.error('Admin payment link send error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się wysłać linku do płatności' });
  }
});

router.post('/reservations/:id/change-term', adminAuth, async (req: Request, res: Response) => {
  try {
    const input = termChangeSchema.parse(req.body);
    const reservation = await queries.getReservationById(Number(req.params.id));
    if (!reservation) {
      res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
      return;
    }
    if (reservation.status !== 'picked_up') {
      res.status(409).json({ success: false, message: 'Termin można zmienić tylko dla wydanego sprzętu' });
      return;
    }
    if (input.isIndefinite && reservation.is_indefinite) {
      res.status(400).json({ success: false, message: 'Ten wynajem jest już bezterminowy' });
      return;
    }

    let endDate: string | null = null;
    let days = Number(reservation.days);
    let basePrice = Number(reservation.base_price);
    let totalPrice = Number(reservation.total_price);
    if (!input.isIndefinite) {
      if (!input.endDate || Number.isNaN(Date.parse(input.endDate))) {
        res.status(400).json({ success: false, message: 'Podaj prawidłową datę zwrotu' });
        return;
      }
      endDate = input.endDate;
      const currentEnd = reservation.end_date ? String(reservation.end_date) : null;
      const currentEndAt = currentEnd
        ? Date.parse(`${currentEnd.slice(0, 10)}T${reservation.end_time || '09:00'}`)
        : null;
      const newEndAt = Date.parse(`${endDate}T${input.endTime}`);
      if (currentEndAt !== null && newEndAt <= currentEndAt) {
        res.status(400).json({ success: false, message: 'Nowy termin musi być późniejszy od obecnego terminu zwrotu' });
        return;
      }
      if (Date.parse(endDate) < Date.parse(String(reservation.start_date))) {
        res.status(400).json({ success: false, message: 'Termin zwrotu nie może być wcześniejszy od odbioru' });
        return;
      }

      const dateDiff = Math.round(
        (Date.parse(endDate) - Date.parse(String(reservation.start_date))) / 86_400_000
      );
      const [startHour, startMinute] = String(reservation.start_time || '09:00').split(':').map(Number);
      const [endHour, endMinute] = input.endTime.split(':').map(Number);
      const extraDay = endHour * 60 + endMinute > startHour * 60 + startMinute ? 1 : 0;
      days = Math.max(1, dateDiff + extraDay);
      const pickupDay = new Date(`${String(reservation.start_date)}T12:00:00`).getDay();
      const pricing = calculateRentalItemsPrice(
        reservationProductIds(reservation),
        days,
        pickupDay === 5 && days === 3
      );
      if (!pricing) throw new Error('Nie udało się przeliczyć sprzętu');
      basePrice = pricing.basePrice;
      const fixedFees = Number(reservation.total_price) - Number(reservation.base_price);
      totalPrice = basePrice + fixedFees;
    }

    const result = await queries.changeReservationTerm({
      id: reservation.id,
      endDate,
      endTime: input.endTime,
      isIndefinite: input.isIndefinite,
      days,
      basePrice,
      totalPrice,
      itemPrices: input.isIndefinite
        ? (reservation.items || []).map((item: any) => ({ productId: String(item.product_id), itemPrice: Number(item.item_price) }))
        : (calculateRentalItemsPrice(
            reservationProductIds(reservation),
            days,
            new Date(`${String(reservation.start_date)}T12:00:00`).getDay() === 5 && days === 3
          )?.items.map((item) => ({ productId: item.productId, itemPrice: item.itemPrice })) || []),
      note: input.note,
      changedBy: input.changedBy,
    });
    if (result.conflicts?.length) {
      const conflict = result.conflicts[0];
      res.status(409).json({
        success: false,
        message: `Nie można zmienić terminu: ${getProductName(conflict.product_id)} jest zarezerwowany od ${conflict.start_date}`,
        data: { conflicts: result.conflicts },
      });
      return;
    }

    const priceDelta = totalPrice - Number(reservation.total_price);
    const emailResult = await sendRentalTermChangedEmail({
      email: reservation.email,
      name: reservation.name,
      productName: reservationProductNames(reservation),
      endDate: input.isIndefinite ? 'bezterminowo - do odwołania' : `${endDate} ${input.endTime}`,
      totalPrice,
      priceDelta,
      note: input.note,
    });
    res.json({
      success: true,
      message: input.isIndefinite ? 'Wynajem zmieniono na bezterminowy' : 'Termin wynajmu został przedłużony',
      data: { reservation: result.reservation, priceDelta, emailDelivered: emailResult.delivered },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message || 'Nieprawidłowe dane zmiany' });
      return;
    }
    console.error('Reservation term change error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się zmienić terminu wynajmu' });
  }
});

router.get('/reservations/:id/status-changes', adminAuth, async (req: Request, res: Response) => {
  const reservation = await queries.getReservationById(Number(req.params.id));
  if (!reservation) {
    res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
    return;
  }
  const changes = await queries.getReservationStatusChanges(reservation.id);
  res.json({ success: true, data: changes });
});

// Update reservation status
router.patch('/reservations/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const input = statusChangeSchema.parse(req.body);
    const { status } = input;

    const reservation = await queries.getReservationById(Number(id));
    if (!reservation) {
      res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
      return;
    }

    if (status === 'picked_up' && config.contracts.enabled) {
      const signed = await queries.hasSignedContract(Number(id));
      if (!signed) {
        res.status(409).json({
          success: false,
          message: 'Nie można wydać sprzętu przed podpisaniem umowy najmu',
        });
        return;
      }
      // Wydanie potwierdza podpisany protokol, a nie samo klikniecie w panelu -
      // inaczej sprzet wychodzilby bez dokumentu odbioru.
      const protokol = await queries.hasSignedProtocol(Number(id), 'handover');
      if (!protokol) {
        res.status(409).json({
          success: false,
          message: 'Wydanie potwierdza podpisany protokół wydania — otwórz „Wydaj sprzęt”',
        });
        return;
      }
    }

    if (status === 'returned' && reservation.is_indefinite) {
      res.status(409).json({
        success: false,
        message: 'Najpierw ustal faktyczny termin zwrotu i rozlicz wynajem bezterminowy',
      });
      return;
    }

    // Jedna bramka na kolejnosc statusow i warunki biznesowe. Panel rysuje tylko
    // dozwolone przyciski, ale API musi bronic sie samo.
    const przejscie = canTransition(
      reservation,
      status,
      {
        returnPhotos: await queries.countReservationPhotos(reservation.id, 'after'),
        handoverPhotos: await queries.countReservationPhotos(reservation.id, 'before'),
        handoverProtocolSigned: await queries.hasSignedProtocol(reservation.id, 'handover'),
      }
    );
    if (!przejscie.ok) {
      res.status(409).json({ success: false, message: przejscie.reason });
      return;
    }

    const activeStatuses = ['pending', 'confirmed', 'picked_up'];
    if (activeStatuses.includes(status) && !activeStatuses.includes(reservation.status)) {
      const conflicts = await queries.getReservationActivationConflicts({
        id: reservation.id,
        productIds: reservationProductIds(reservation),
        startDate: String(reservation.start_date),
        endDate: reservation.end_date ? String(reservation.end_date) : null,
      });
      if (conflicts.length > 0) {
        res.status(409).json({
          success: false,
          message: `Nie można przywrócić aktywnego statusu: termin koliduje z rezerwacją #${conflicts[0].id}`,
          data: { conflicts },
        });
        return;
      }
    }
    
    const notifyCustomer = input.notifyCustomer
      ?? ['confirmed', 'rejected', 'picked_up', 'returned'].includes(status);
    const updateResult = await queries.updateReservationStatus({
      id: Number(id),
      status,
      note: input.note || DOMYSLNA_NOTATKA[status] || `Status zmieniono na: ${status}`,
      changedBy: input.changedBy || 'Panel administratora',
      notifyCustomer,
    });
    if (!updateResult.changed) {
      res.json({ success: true, message: 'Status nie wymagał zmiany', data: updateResult.reservation });
      return;
    }
    
    // Send email to customer on confirm/reject
    if (notifyCustomer && (status === 'confirmed' || status === 'rejected')) {
      try {
        await sendReservationStatusEmail({
          email: reservation.email,
          name: reservation.name,
          productName: reservationProductNames(reservation),
          startDate: reservation.start_date,
          endDate: reservation.end_date || 'bezterminowo',
          isIndefinite: Boolean(reservation.is_indefinite),
          totalPrice: reservation.total_price,
        }, status);
        console.log(`📧 Email sent to ${reservation.email} - reservation ${status}`);
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }
    
    // Send email when equipment is picked up
    if (notifyCustomer && status === 'picked_up') {
      try {
        await sendPickedUpEmail({
          email: reservation.email,
          name: reservation.name,
          productName: reservationProductNames(reservation),
          startDate: reservation.start_date,
          endDate: reservation.end_date || 'bezterminowo',
          totalPrice: reservation.total_price,
        });
        console.log(`📧 Picked up email sent to ${reservation.email}`);
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }
    
    // Send email when equipment is returned
    if (status === 'returned') {
      if (notifyCustomer) {
        try {
          await sendReturnedEmail({
            email: reservation.email,
            name: reservation.name,
            productName: reservationProductNames(reservation),
            startDate: reservation.start_date,
            endDate: reservation.end_date || 'bezterminowo',
            totalPrice: reservation.total_price,
          });
          console.log(`📧 Returned email sent to ${reservation.email}`);
        } catch (emailError) {
          console.error('Email send error:', emailError);
        }
      }

      // Auto-send availability notifications
      try {
        for (const productId of reservationProductIds(reservation)) {
          const waitingNotifications = await queries.getWaitingNotificationsForProduct(productId);
          const productName = getProductName(productId);
          for (const notification of waitingNotifications) {
            try {
              const result = await sendProductAvailabilityNotification(notification.email, productName, productId);
              if (result.success) {
                await queries.markNotificationAsSent(notification.id);
                console.log(`📧 Availability notification sent to ${notification.email}`);
              }
            } catch (notifyError) {
              console.error(`Failed to notify ${notification.email}:`, notifyError);
            }
          }
        }
      } catch (notifyError) {
        console.error('Auto-notify error:', notifyError);
      }
    }

    // Auto-send availability notifications when cancelled/rejected
    if (status === 'cancelled' || status === 'rejected') {
      try {
        for (const productId of reservationProductIds(reservation)) {
          const waitingNotifications = await queries.getWaitingNotificationsForProduct(productId);
          const productName = getProductName(productId);
          for (const notification of waitingNotifications) {
            try {
              const result = await sendProductAvailabilityNotification(notification.email, productName, productId);
              if (result.success) await queries.markNotificationAsSent(notification.id);
            } catch (notifyError) {
              console.error(`Failed to notify ${notification.email}:`, notifyError);
            }
          }
        }
      } catch (notifyError) {
        console.error('Auto-notify error:', notifyError);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Status zmieniony na: ${status}`,
      data: updateResult.reservation
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message || 'Nieprawidłowy status' });
      return;
    }
    console.error('Admin update reservation error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Get single reservation
router.get('/reservations/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reservation = await queries.getReservationById(Number(id));

    if (!reservation) {
      res.status(404).json({ success: false, message: 'Rezerwacja nie znaleziona' });
      return;
    }

    res.json({ success: true, data: reservation });
  } catch (error) {
    console.error('Admin get reservation error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Get all contacts
router.get('/contacts', adminAuth, async (_req: Request, res: Response) => {
  try {
    const contacts = await queries.getContacts();
    res.json({ success: true, data: contacts });
  } catch (error) {
    console.error('Admin contacts error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Update contact status
router.patch('/contacts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['new', 'read', 'replied', 'archived'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ 
        success: false, 
        message: `Nieprawidłowy status. Dozwolone: ${validStatuses.join(', ')}` 
      });
      return;
    }

    await queries.updateContactStatus({ id: Number(id), status });

    res.json({ 
      success: true, 
      message: `Status zmieniony na: ${status}`
    });
  } catch (error) {
    console.error('Admin update contact error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Dashboard stats
router.get('/stats', adminAuth, async (_req: Request, res: Response) => {
  try {
    const reservations = await queries.getReservations();
    const contacts = await queries.getContacts();
    const revenueToday = await queries.getRevenueToday();
    const revenueMonth = await queries.getRevenueThisMonth();
    const revenueTotal = await queries.getRevenueTotal();

    const stats = {
      reservations: {
        total: reservations.length,
        pending: reservations.filter((r: any) => r.status === 'pending').length,
        confirmed: reservations.filter((r: any) => r.status === 'confirmed').length,
        picked_up: reservations.filter((r: any) => r.status === 'picked_up').length,
        returned: reservations.filter((r: any) => r.status === 'returned').length,
        completed: reservations.filter((r: any) => r.status === 'completed').length,
        rejected: reservations.filter((r: any) => r.status === 'rejected').length,
      },
      contacts: {
        total: contacts.length,
        new: contacts.filter((c: any) => c.status === 'new' || !c.status).length,
      },
      revenue: {
        today: revenueToday?.revenue || 0,
        month: revenueMonth?.revenue || 0,
        total: revenueTotal?.revenue || 0,
        pending: reservations
          .filter((r: any) => ['pending', 'confirmed', 'picked_up'].includes(r.status))
          .reduce((sum: number, r: any) => sum + (r.total_price || 0), 0),
      }
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Revenue details
router.get('/revenue', adminAuth, async (_req: Request, res: Response) => {
  try {
    const today = (await queries.getRevenueToday())?.revenue || 0;
    const month = (await queries.getRevenueThisMonth())?.revenue || 0;
    const total = (await queries.getRevenueTotal())?.revenue || 0;
    const byMonth = await queries.getRevenueByMonth();
    
    const reservations = await queries.getReservations();
    const pending = reservations
      .filter((r: any) => ['pending', 'confirmed', 'picked_up'].includes(r.status))
      .reduce((sum: number, r: any) => sum + (r.total_price || 0), 0);
    
    res.json({
      success: true,
      data: { today, month, total, pending, byMonth }
    });
  } catch (error) {
    console.error('Admin revenue error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Delete contact
router.delete('/contacts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contact = await queries.getContactById(Number(id));
    if (!contact) {
      res.status(404).json({ success: false, message: 'Wiadomość nie znaleziona' });
      return;
    }

    await queries.deleteContact(Number(id));
    res.json({ success: true, message: 'Wiadomość usunięta' });
  } catch (error) {
    console.error('Admin delete contact error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Delete multiple contacts
router.post('/contacts/delete-many', adminAuth, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, message: 'Podaj listę ID do usunięcia' });
      return;
    }

    await queries.deleteContacts(ids.map(Number));

    res.json({ 
      success: true, 
      message: `Usunięto ${ids.length} wiadomości`,
      deleted: ids.length
    });
  } catch (error) {
    console.error('Admin delete contacts error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Get contact with replies
router.get('/contacts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contact = await queries.getContactById(Number(id));

    if (!contact) {
      res.status(404).json({ success: false, message: 'Wiadomość nie znaleziona' });
      return;
    }

    const replies = await queries.getRepliesByContact(Number(id));
    res.json({ success: true, data: { ...contact, replies } });
  } catch (error) {
    console.error('Admin get contact error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Reply to contact
router.post('/contacts/:id/reply', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length < 5) {
      res.status(400).json({ 
        success: false, 
        message: 'Wiadomość musi mieć co najmniej 5 znaków' 
      });
      return;
    }

    const contact = await queries.getContactById(Number(id));
    if (!contact) {
      res.status(404).json({ success: false, message: 'Wiadomość nie znaleziona' });
      return;
    }

    await queries.insertContactReply({
      contactId: Number(id),
      message: message.trim(),
      sentBy: 'admin',
    });

    await queries.updateContactStatus({ id: Number(id), status: 'replied' });

    await sendContactReply(
      contact.email,
      contact.name,
      contact.subject,
      message.trim()
    );

    const replies = await queries.getRepliesByContact(Number(id));

    res.json({ 
      success: true, 
      message: 'Odpowiedź wysłana!',
      data: { replies }
    });
  } catch (error) {
    console.error('Admin reply error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Send reminders
router.post('/send-reminders', adminAuth, async (_req: Request, res: Response) => {
  try {
    const { sendPickupReminderEmail, sendReturnReminderEmail } = await import('./email.js');
    
    const allReservations = await queries.getReservations();
    console.log(`📊 Total reservations: ${allReservations.length}`);
    
    const pickupReminders = await queries.getReservationsForPickupReminder();
    const returnReminders = await queries.getReservationsForReturnReminder();
    
    console.log(`📬 Pickup reminders: ${pickupReminders.length}`);
    console.log(`📬 Return reminders: ${returnReminders.length}`);
    
    let sentPickup = 0;
    let sentReturn = 0;
    
    for (const reservation of pickupReminders) {
      try {
        await sendPickupReminderEmail({
          email: reservation.email,
          name: reservation.name,
          productName: reservationProductNames(reservation),
          startDate: reservation.start_date,
          endDate: reservation.end_date,
        });
        sentPickup++;
        console.log(`📧 Pickup reminder sent to ${reservation.email}`);
      } catch (err) {
        console.error(`Failed to send pickup reminder to ${reservation.email}:`, err);
      }
    }
    
    for (const reservation of returnReminders) {
      try {
        await sendReturnReminderEmail({
          email: reservation.email,
          name: reservation.name,
          productName: reservationProductNames(reservation),
          startDate: reservation.start_date,
          endDate: reservation.end_date,
        });
        sentReturn++;
        console.log(`📧 Return reminder sent to ${reservation.email}`);
      } catch (err) {
        console.error(`Failed to send return reminder to ${reservation.email}:`, err);
      }
    }
    
    res.json({
      success: true,
      message: `Wysłano przypomnienia: ${sentPickup} o odbiorze, ${sentReturn} o zwrocie`,
      data: {
        pickupReminders: sentPickup,
        returnReminders: sentReturn,
        debug: {
          totalReservations: allReservations.length,
          foundForPickup: pickupReminders.length,
          foundForReturn: returnReminders.length,
        }
      }
    });
  } catch (error) {
    console.error('Send reminders error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Debug reminders
router.get('/debug-reminders', adminAuth, async (_req: Request, res: Response) => {
  try {
    const allReservations = await queries.getReservations();
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      todayDate: todayStr,
      tomorrowDate: tomorrowStr,
      totalReservations: allReservations.length,
      reservations: allReservations.map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        product_id: r.product_id,
        product_ids: reservationProductIds(r),
        product_names: reservationProductNames(r),
        status: r.status,
        start_date: r.start_date,
        end_date: r.end_date,
        needsPickupReminder: ['pending', 'confirmed'].includes(r.status) && 
          (r.start_date === todayStr || r.start_date === tomorrowStr),
        needsReturnReminder: r.status === 'picked_up' && r.end_date === tomorrowStr,
      }))
    });
  } catch (error) {
    console.error('Debug reminders error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// Test reminder email
router.post('/test-reminder-email', adminAuth, async (req: Request, res: Response) => {
  try {
    const { email, type } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email jest wymagany' });
    }
    
    const { sendPickupReminderEmail, sendReturnReminderEmail } = await import('./email.js');
    
    const testReservation = {
      email,
      name: 'Test User',
      productName: 'Odkurzacz Piorący Kärcher Puzzi 10/1',
      startDate: '2026-01-22',
      endDate: '2026-01-25',
    };
    
    let result;
    if (type === 'return') {
      result = await sendReturnReminderEmail(testReservation);
    } else {
      result = await sendPickupReminderEmail(testReservation);
    }
    
    res.json({
      success: true,
      message: `Wysłano testowy email przypomnienia (${type || 'pickup'}) do ${email}`,
      result
    });
  } catch (error: any) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, message: error.message || 'Błąd serwera' });
  }
});

// === NEWSLETTER ===

router.get('/newsletter/subscribers', adminAuth, async (_req: Request, res: Response) => {
  try {
    const subscribers = await queries.getAllSubscribers();
    const activeCount = (await queries.getActiveSubscribersCount())?.count || 0;

    res.json({
      success: true,
      data: subscribers,
      stats: { activeCount }
    });
  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.delete('/newsletter/subscribers/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await queries.deleteSubscriber(Number(id));
    res.json({ success: true, message: 'Subskrybent usunięty' });
  } catch (error) {
    console.error('Delete subscriber error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.get('/newsletter/posts', adminAuth, async (_req: Request, res: Response) => {
  try {
    const posts = await queries.getPosts();
    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.post('/newsletter/posts', adminAuth, async (req: Request, res: Response) => {
  try {
    const data = newsletterPostSchema.parse(req.body);
    const result = await queries.insertPost({
      title: data.title,
      content: data.content,
      status: 'draft',
    });

    res.status(201).json({
      success: true,
      message: 'Post utworzony',
      id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.patch('/newsletter/posts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = newsletterPostSchema.parse(req.body);

    await queries.updatePost({
      id: Number(id),
      title: data.title,
      content: data.content,
      status: data.status || 'draft',
    });

    res.json({ success: true, message: 'Post zaktualizowany' });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.delete('/newsletter/posts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await queries.deletePost(Number(id));
    res.json({ success: true, message: 'Post usunięty' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.post('/newsletter/posts/:id/send', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const post = await queries.getPostById(Number(id));
    
    if (!post) {
      res.status(404).json({ success: false, message: 'Post nie znaleziony' });
      return;
    }

    const subscribers = await queries.getSubscribers();
    
    if (subscribers.length === 0) {
      res.status(400).json({ 
        success: false, 
        message: 'Brak aktywnych subskrybentów' 
      });
      return;
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const subscriber of subscribers) {
      try {
        await sendNewsletterEmail({
          email: subscriber.email,
          name: subscriber.name,
          title: post.title,
          content: post.content,
        });
        sentCount++;
      } catch (err) {
        failedCount++;
        console.error(`Failed to send to ${subscriber.email}:`, err);
      }
    }

    await queries.markPostAsSent({ id: Number(id), sentCount });

    res.json({
      success: true,
      message: `Newsletter wysłany do ${sentCount} subskrybentów`,
      data: { sentCount, failedCount }
    });
  } catch (error) {
    console.error('Send newsletter error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.get('/newsletter/stats', adminAuth, async (_req: Request, res: Response) => {
  try {
    const subscribers = await queries.getAllSubscribers();
    const posts = await queries.getPosts();
    const activeCount = (await queries.getActiveSubscribersCount())?.count || 0;
    const sentPosts = posts.filter((p: any) => p.status === 'sent').length;

    res.json({
      success: true,
      data: {
        totalSubscribers: subscribers.length,
        activeSubscribers: activeCount,
        totalPosts: posts.length,
        sentPosts,
      }
    });
  } catch (error) {
    console.error('Get newsletter stats error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// === NOTIFICATIONS ===

router.get('/notifications', adminAuth, async (_req: Request, res: Response) => {
  try {
    const notifications = await queries.getProductNotifications();
    
    const enrichedNotifications = notifications.map((n: any) => ({
      ...n,
      productName: getProductName(n.product_id),
    }));

    res.json({ success: true, data: enrichedNotifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.get('/notifications/stats', adminAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await queries.getNotificationStats();

    res.json({
      success: true,
      data: {
        total: stats?.total || 0,
        waiting: stats?.waiting || 0,
        sent: stats?.sent || 0,
      }
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.delete('/notifications/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await queries.deleteProductNotification(Number(id));
    res.json({ success: true, message: 'Powiadomienie usunięte' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.post('/notifications/send/:productId', adminAuth, async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId as string;

    if (!products[productId]) {
      res.status(400).json({ success: false, message: 'Produkt nie istnieje' });
      return;
    }
    const productName = getProductName(productId);

    const notifications = await queries.getWaitingNotificationsForProduct(productId);

    if (notifications.length === 0) {
      res.json({ success: true, message: 'Brak osób oczekujących' });
      return;
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const notification of notifications) {
      try {
        const result = await sendProductAvailabilityNotification(
          notification.email,
          productName,
          productId
        );
        
        if (result.success) {
          await queries.markNotificationAsSent(notification.id);
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        failedCount++;
      }
    }

    res.json({
      success: true,
      message: `Wysłano ${sentCount} powiadomień`,
      data: { sentCount, failedCount }
    });
  } catch (error) {
    console.error('Send notifications error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

// === DOCUMENT ARCHIVE ===

const parseDocumentMetadata = (body: Record<string, any>) =>
  documentMetadataSchema.parse({
    title: body.title,
    category: body.category || undefined,
    reservationId: body.reservationId ? Number(body.reservationId) : null,
    customerEmail: typeof body.customerEmail === 'string' ? body.customerEmail : '',
    documentDate: body.documentDate || null,
    notes: typeof body.notes === 'string' ? body.notes : '',
  });

router.get('/documents', adminAuth, async (req: Request, res: Response) => {
  try {
    const documents = await queries.getDocuments({
      archived: req.query.archived === undefined ? undefined : req.query.archived === 'true',
      category: typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined,
      reservationId: req.query.reservationId ? Number(req.query.reservationId) : undefined,
      search: typeof req.query.search === 'string' && req.query.search ? req.query.search : undefined,
    });
    res.json({ success: true, data: documents });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się pobrać dokumentów' });
  }
});

router.post('/documents', adminAuth, (req: Request, res: Response) => {
  documentUpload.single('file')(req, res, async (uploadError) => {
    let stored: Awaited<ReturnType<typeof saveDocumentFile>> | null = null;
    try {
      if (uploadError) {
        const message = uploadError instanceof Error && uploadError.message.includes('File too large')
          ? 'Dokument może mieć maksymalnie 15 MB'
          : 'Nie udało się odczytać pliku';
        res.status(400).json({ success: false, message });
        return;
      }
      if (!req.file?.buffer) {
        res.status(400).json({ success: false, message: 'Wybierz plik do wysłania' });
        return;
      }

      const metadata = parseDocumentMetadata(req.body ?? {});
      stored = await saveDocumentFile(req.file.buffer);

      const document = await queries.insertDocument({
        title: metadata.title,
        category: metadata.category,
        reservationId: metadata.reservationId,
        customerEmail: metadata.customerEmail,
        documentDate: metadata.documentDate,
        // Client-supplied name is only a label; the stored path is server-generated.
        fileName: `${metadata.title.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 60)}.${stored.extension}`,
        filePath: stored.filePath,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        fileHash: stored.fileHash,
        source: 'manual',
        notes: metadata.notes,
        uploadedBy: 'admin',
      });

      res.status(201).json({ success: true, data: document, message: 'Dokument został dodany do archiwum' });
    } catch (error) {
      // Never leave an orphaned encrypted blob behind when the row insert fails.
      if (stored) await deleteDocumentFile(stored.filePath).catch(() => undefined);
      if (error instanceof ZodError) {
        res.status(400).json({ success: false, message: error.issues[0]?.message || 'Nieprawidłowe dane dokumentu' });
        return;
      }
      const message = error instanceof Error ? error.message : 'Nie udało się zapisać dokumentu';
      console.error('Upload document error:', error);
      res.status(400).json({ success: false, message });
    }
  });
});

router.get('/documents/:id/download', adminAuth, async (req: Request, res: Response) => {
  try {
    const document = await queries.getDocumentById(Number(req.params.id));
    if (!document) {
      res.status(404).json({ success: false, message: 'Dokument nie istnieje' });
      return;
    }
    const file = await readDocumentFile(document.file_path);
    const safeName = String(document.file_name).replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file);
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się pobrać dokumentu' });
  }
});

router.put('/documents/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const metadata = parseDocumentMetadata(req.body ?? {});
    const document = await queries.updateDocument(Number(req.params.id), metadata);
    if (!document) {
      res.status(404).json({ success: false, message: 'Dokument nie istnieje' });
      return;
    }
    res.json({ success: true, data: document, message: 'Dokument został zapisany' });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message || 'Nieprawidłowe dane dokumentu' });
      return;
    }
    console.error('Update document error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się zapisać dokumentu' });
  }
});

router.post('/documents/:id/archive', adminAuth, async (req: Request, res: Response) => {
  try {
    const archived = req.body?.archived !== false;
    const document = await queries.setDocumentArchived(Number(req.params.id), archived);
    if (!document) {
      res.status(404).json({ success: false, message: 'Dokument nie istnieje' });
      return;
    }
    res.json({
      success: true,
      data: document,
      message: archived ? 'Dokument przeniesiony do archiwum' : 'Dokument przywrócony z archiwum',
    });
  } catch (error) {
    console.error('Archive document error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się zmienić statusu dokumentu' });
  }
});

router.delete('/documents/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const document = await queries.getDocumentById(Number(req.params.id));
    if (!document) {
      res.status(404).json({ success: false, message: 'Dokument nie istnieje' });
      return;
    }
    // Signed contracts are legally binding records - archive, never delete.
    if (document.source === 'system') {
      res.status(409).json({
        success: false,
        message: 'Umowy podpisanej w systemie nie można usunąć. Przenieś ją do archiwum.',
      });
      return;
    }

    const deleted = await queries.deleteDocument(document.id);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Dokument nie istnieje' });
      return;
    }
    await deleteDocumentFile(deleted.file_path).catch((error) =>
      console.error('Delete document file error:', error));
    res.json({ success: true, message: 'Dokument został usunięty' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się usunąć dokumentu' });
  }
});

// === DISCOUNTS ===

router.get('/discounts', adminAuth, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await queries.getDiscounts() });
  } catch (error) {
    console.error('Get discounts error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się pobrać rabatów' });
  }
});

router.post('/discounts', adminAuth, async (req: Request, res: Response) => {
  try {
    const data = discountSchema.parse(req.body);
    const discount = await queries.insertDiscount(data);
    res.status(201).json({ success: true, data: discount, message: 'Rabat został dodany' });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message || 'Nieprawidłowe dane rabatu' });
      return;
    }
    console.error('Create discount error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się dodać rabatu' });
  }
});

router.put('/discounts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const data = discountSchema.parse(req.body);
    const discount = await queries.updateDiscount(Number(req.params.id), data);
    if (!discount) {
      res.status(404).json({ success: false, message: 'Rabat nie istnieje' });
      return;
    }
    res.json({ success: true, data: discount, message: 'Rabat został zapisany' });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message || 'Nieprawidłowe dane rabatu' });
      return;
    }
    console.error('Update discount error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się zapisać rabatu' });
  }
});

router.delete('/discounts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await queries.deleteDiscount(Number(req.params.id));
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Rabat nie istnieje' });
      return;
    }
    res.json({ success: true, message: 'Rabat został usunięty' });
  } catch (error) {
    console.error('Delete discount error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się usunąć rabatu' });
  }
});

// === COUPONS ===

const addDaysLocal = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const buildCouponPdf = async (coupon: any) => {
  const settings = await loadBusinessSettings();
  return generateCouponPdf({
    code: coupon.code,
    discountType: coupon.discount_type,
    value: Number(coupon.value),
    minTotal: Number(coupon.min_total),
    expiresOn: coupon.expires_on ? String(coupon.expires_on).slice(0, 10) : null,
    customerName: coupon.customer_name || '',
    termsText: settings.coupons.termsText,
  });
};

router.get('/coupons', adminAuth, async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
    const [data, stats] = await Promise.all([queries.getCoupons(status), queries.getCouponStats()]);
    res.json({ success: true, data, stats });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się pobrać kuponów' });
  }
});

router.post('/coupons', adminAuth, async (req: Request, res: Response) => {
  try {
    const data = couponCreateSchema.parse(req.body);

    // Retry on the (astronomically unlikely) unique-code collision.
    let coupon: any = null;
    for (let attempt = 0; attempt < 5 && !coupon; attempt += 1) {
      try {
        coupon = await queries.insertCoupon({
          code: generateCouponCode(),
          discountType: data.discountType,
          value: data.value,
          customerEmail: data.customerEmail,
          customerName: data.customerName,
          minTotal: data.minTotal,
          expiresOn: addDaysLocal(data.validDays),
          issuedForReservationId: data.issuedForReservationId,
          issuedBy: 'admin',
          note: data.note,
        });
      } catch (error: any) {
        if (error?.code !== '23505') throw error;
      }
    }
    if (!coupon) {
      res.status(500).json({ success: false, message: 'Nie udało się wygenerować unikalnego kodu' });
      return;
    }

    let emailed = false;
    if (data.sendEmail && data.customerEmail) {
      const settings = await loadBusinessSettings();
      const pdf = await buildCouponPdf(coupon);
      const result = await sendCouponEmail(data.customerEmail, {
        code: coupon.code,
        customerName: coupon.customer_name,
        valueLabel: formatCouponValue(coupon.discount_type, Number(coupon.value)),
        minTotal: Number(coupon.min_total),
        expiresOn: String(coupon.expires_on).slice(0, 10),
        termsText: settings.coupons.termsText,
      }, pdf);
      emailed = result.delivered;
      if (emailed) await queries.markCouponEmailSent(coupon.id);
    }

    res.status(201).json({
      success: true,
      data: coupon,
      emailed,
      message: emailed ? 'Kupon wygenerowany i wysłany mailem' : 'Kupon został wygenerowany',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message || 'Nieprawidłowe dane kuponu' });
      return;
    }
    console.error('Create coupon error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się wygenerować kuponu' });
  }
});

router.get('/coupons/:id/pdf', adminAuth, async (req: Request, res: Response) => {
  try {
    const coupon = await queries.getCouponById(Number(req.params.id));
    if (!coupon) {
      res.status(404).json({ success: false, message: 'Kupon nie istnieje' });
      return;
    }
    const pdf = await buildCouponPdf(coupon);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="kupon-${coupon.code}.pdf"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(pdf);
  } catch (error) {
    console.error('Coupon PDF error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się wygenerować PDF kuponu' });
  }
});

router.post('/coupons/:id/send-email', adminAuth, async (req: Request, res: Response) => {
  try {
    const coupon = await queries.getCouponById(Number(req.params.id));
    if (!coupon) {
      res.status(404).json({ success: false, message: 'Kupon nie istnieje' });
      return;
    }
    const recipient = String(req.body?.email || coupon.customer_email || '').trim();
    if (!recipient) {
      res.status(400).json({ success: false, message: 'Podaj adres email odbiorcy' });
      return;
    }

    const settings = await loadBusinessSettings();
    const pdf = await buildCouponPdf(coupon);
    const result = await sendCouponEmail(recipient, {
      code: coupon.code,
      customerName: coupon.customer_name || '',
      valueLabel: formatCouponValue(coupon.discount_type, Number(coupon.value)),
      minTotal: Number(coupon.min_total),
      expiresOn: coupon.expires_on ? String(coupon.expires_on).slice(0, 10) : null,
      termsText: settings.coupons.termsText,
    }, pdf);

    if (!result.delivered) {
      res.status(502).json({ success: false, message: 'Nie udało się wysłać kuponu mailem' });
      return;
    }
    await queries.markCouponEmailSent(coupon.id);
    res.json({ success: true, message: `Kupon wysłany na ${recipient}` });
  } catch (error) {
    console.error('Send coupon email error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się wysłać kuponu' });
  }
});

router.post('/coupons/:id/cancel', adminAuth, async (req: Request, res: Response) => {
  try {
    const coupon = await queries.cancelCoupon(Number(req.params.id));
    if (!coupon) {
      res.status(409).json({ success: false, message: 'Można anulować tylko aktywny kupon' });
      return;
    }
    res.json({ success: true, data: coupon, message: 'Kupon został anulowany' });
  } catch (error) {
    console.error('Cancel coupon error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się anulować kuponu' });
  }
});

// === HANDOVER PHOTOS ===

router.get('/reservations/:id/photos', adminAuth, async (req: Request, res: Response) => {
  try {
    const photos = await queries.getReservationPhotos(Number(req.params.id));
    res.json({ success: true, data: photos });
  } catch (error) {
    console.error('Get reservation photos error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się pobrać zdjęć' });
  }
});

router.post('/reservations/:id/photos', adminAuth, (req: Request, res: Response) => {
  photoUpload.single('photo')(req, res, async (uploadError) => {
    let stored: Awaited<ReturnType<typeof savePhotoFile>> | null = null;
    try {
      if (uploadError) {
        const message = uploadError instanceof Error && uploadError.message.includes('File too large')
          ? 'Zdjęcie może mieć maksymalnie 12 MB'
          : 'Nie udało się odczytać zdjęcia';
        res.status(400).json({ success: false, message });
        return;
      }
      if (!req.file?.buffer) {
        res.status(400).json({ success: false, message: 'Wybierz zdjęcie' });
        return;
      }

      const reservationId = Number(req.params.id);
      const reservation = await queries.getReservationById(reservationId);
      if (!reservation) {
        res.status(404).json({ success: false, message: 'Rezerwacja nie istnieje' });
        return;
      }

      const phase = req.body?.phase === 'after' ? 'after' : 'before';
      stored = await savePhotoFile(req.file.buffer);

      const photo = await queries.insertReservationPhoto({
        reservationId,
        productId: String(req.body?.productId || ''),
        phase,
        filePath: stored.filePath,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        fileHash: stored.fileHash,
        note: String(req.body?.note || '').slice(0, 300),
        takenBy: String(req.body?.takenBy || '').slice(0, 150),
      });

      res.status(201).json({
        success: true,
        data: { ...photo, file_path: undefined },
        message: phase === 'before' ? 'Zdjęcie przed wydaniem zapisane' : 'Zdjęcie po zwrocie zapisane',
      });
    } catch (error) {
      if (stored) await deleteDocumentFile(stored.filePath).catch(() => undefined);
      const message = error instanceof Error ? error.message : 'Nie udało się zapisać zdjęcia';
      console.error('Upload reservation photo error:', error);
      res.status(400).json({ success: false, message });
    }
  });
});

router.get('/photos/:id/file', adminAuth, async (req: Request, res: Response) => {
  try {
    const photo = await queries.getReservationPhotoById(Number(req.params.id));
    if (!photo) {
      res.status(404).json({ success: false, message: 'Zdjęcie nie istnieje' });
      return;
    }
    const file = await readDocumentFile(photo.file_path);
    res.setHeader('Content-Type', photo.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="zdjecie-${photo.id}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file);
  } catch (error) {
    console.error('Read reservation photo error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się pobrać zdjęcia' });
  }
});

router.delete('/photos/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await queries.deleteReservationPhoto(Number(req.params.id));
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Zdjęcie nie istnieje' });
      return;
    }
    await deleteDocumentFile(deleted.file_path).catch((error) =>
      console.error('Delete photo file error:', error));
    res.json({ success: true, message: 'Zdjęcie zostało usunięte' });
  } catch (error) {
    console.error('Delete reservation photo error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się usunąć zdjęcia' });
  }
});

// === BUSINESS SETTINGS ===

router.get('/settings', adminAuth, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await loadBusinessSettings() });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się pobrać ustawień' });
  }
});

router.put('/settings', adminAuth, async (req: Request, res: Response) => {
  try {
    const settings = businessSettingsSchema.parse(req.body ?? {});
    await queries.setSetting(BUSINESS_SETTINGS_KEY, JSON.stringify(settings));
    res.json({ success: true, data: settings, message: 'Ustawienia zostały zapisane' });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message || 'Nieprawidłowe ustawienia' });
      return;
    }
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Nie udało się zapisać ustawień' });
  }
});

export default router;
