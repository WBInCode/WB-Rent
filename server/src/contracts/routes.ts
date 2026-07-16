import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { queries } from '../db.js';
import { createPaymentForReservation } from '../payments/routes.js';
import { getContractPreview, readSignedContractPdfByToken, signContract } from './service.js';
import { CONTRACT_TEMPLATE_VERSION } from './template.js';

const router = Router();

const signLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: { success: false, message: 'Zbyt wiele prób podpisu. Spróbuj ponownie później.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/config', (_req: Request, res: Response) => {
  res.json({
    success: true,
    enabled: config.contracts.enabled,
    requiredBeforePayment: config.contracts.requireBeforePayment,
    templateVersion: CONTRACT_TEMPLATE_VERSION,
  });
});

router.get('/sign/:token', async (req: Request, res: Response) => {
  try {
    const preview = await getContractPreview(String(req.params.token));
    if (!preview) {
      res.status(404).json({ success: false, message: 'Umowa nie istnieje' });
      return;
    }
    if (preview.expired) {
      res.status(410).json({ success: false, message: 'Sesja podpisu wygasła. Poproś pracownika o nowy link.' });
      return;
    }
    res.json({ success: true, ...preview });
  } catch (error) {
    console.error('Contract preview error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

router.post('/sign/:token', signLimiter, async (req: Request, res: Response) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || 'unknown';
    const result = await signContract({
      token: String(req.params.token),
      signatureDataUrl: String(req.body?.signature || ''),
      accepted: req.body?.accepted === true,
      ip,
      userAgent: String(req.headers['user-agent'] || 'unknown'),
    });

    let payment: { redirectUrl: string; sessionId: string } | null = null;
    const reservation = await queries.getReservationById(result.reservationId);
    if (reservation) {
      try {
        payment = await createPaymentForReservation(reservation, ip);
      } catch (paymentError) {
        console.error('Post-contract payment create error:', paymentError);
      }
    }

    res.json({
      success: true,
      message: 'Umowa została podpisana, zapisana i wysłana na e-mail.',
      contractNumber: result.contractNumber,
      pdfHash: result.pdfHash,
      pdfUrl: `/api/contracts/sign/${encodeURIComponent(String(req.params.token))}/pdf`,
      payment,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się podpisać umowy';
    const status = /wygasła|już podpisana|nie istnieje/.test(message) ? 409 : 400;
    res.status(status).json({ success: false, message });
  }
});

router.get('/sign/:token/pdf', async (req: Request, res: Response) => {
  try {
    const pdf = await readSignedContractPdfByToken(String(req.params.token));
    if (!pdf) {
      res.status(404).json({ success: false, message: 'Podpisany dokument nie istnieje' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf.buffer);
  } catch (error) {
    console.error('Contract PDF download error:', error);
    res.status(500).json({ success: false, message: 'Błąd serwera' });
  }
});

export default router;