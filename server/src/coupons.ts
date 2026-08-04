import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const regularFont = path.resolve(moduleDir, '../assets/fonts/NotoSans-Regular.ttf');
const boldFont = path.resolve(moduleDir, '../assets/fonts/NotoSans-Bold.ttf');

// Ambiguous characters (0/O, 1/I/L) removed so codes can be read from a printout.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const randomBlock = (length: number): string => {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
};

/** Cryptographically random voucher code, e.g. WBR-7K4M-QX92. */
export const generateCouponCode = (): string => `WBR-${randomBlock(4)}-${randomBlock(4)}`;

export interface CouponPdfData {
  code: string;
  discountType: 'percent' | 'amount';
  value: number;
  minTotal: number;
  expiresOn: string | null;
  customerName: string;
  termsText: string;
}

export const formatCouponValue = (type: 'percent' | 'amount', value: number): string =>
  type === 'percent' ? `${value % 1 === 0 ? value : value.toFixed(1)}%` : `${value.toFixed(2).replace('.', ',')} zł`;

/** Single-page printable voucher (A5 landscape). */
export function generateCouponPdf(data: CouponPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A5',
      layout: 'landscape',
      margins: { top: 36, bottom: 36, left: 40, right: 40 },
      info: { Title: `Kupon rabatowy ${data.code}`, Author: 'WB-Rent / WB Partners Sp. z o.o.' },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('regular', regularFont);
    doc.registerFont('bold', boldFont);

    const width = doc.page.width - 80;
    const gold = '#b8972a';
    const dark = '#1a1a1a';

    doc.save();
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(2).stroke(gold);
    doc.restore();

    doc.font('bold').fontSize(11).fillColor(gold).text('WB-RENT', 40, 44, { width, align: 'center', characterSpacing: 3 });
    doc.font('regular').fontSize(8).fillColor('#666666')
      .text('WYNAJEM SPRZĘTU BUDOWLANEGO', { width, align: 'center', characterSpacing: 1.5 });

    doc.moveDown(1.2);
    doc.font('bold').fontSize(22).fillColor(dark).text('KUPON RABATOWY', { width, align: 'center' });

    doc.moveDown(0.6);
    doc.font('bold').fontSize(38).fillColor(gold)
      .text(formatCouponValue(data.discountType, data.value), { width, align: 'center' });

    doc.moveDown(0.2);
    doc.font('regular').fontSize(10).fillColor('#444444')
      .text('na kolejny najem sprzętu', { width, align: 'center' });

    const codeY = doc.y + 14;
    doc.save();
    doc.roundedRect(40 + width / 2 - 110, codeY, 220, 38, 6).lineWidth(1).dash(3, { space: 3 }).stroke('#999999');
    doc.restore();
    doc.font('bold').fontSize(19).fillColor(dark)
      .text(data.code, 40, codeY + 10, { width, align: 'center', characterSpacing: 2 });

    doc.y = codeY + 50;
    const details: string[] = [];
    if (data.customerName) details.push(`Dla: ${data.customerName}`);
    if (data.minTotal > 0) details.push(`Minimalna kwota najmu: ${data.minTotal.toFixed(2).replace('.', ',')} zł`);
    details.push(data.expiresOn ? `Ważny do: ${data.expiresOn}` : 'Bez terminu ważności');

    doc.font('regular').fontSize(9).fillColor('#333333')
      .text(details.join('   •   '), 40, doc.y, { width, align: 'center' });

    const terms = data.termsText
      || 'Kupon jednorazowy, nie łączy się z innymi promocjami i nie podlega wymianie na gotówkę. Rabat obejmuje wyłącznie koszt najmu sprzętu (bez transportu i opłat dodatkowych). Kod należy podać przy składaniu rezerwacji.';
    doc.font('regular').fontSize(7).fillColor('#777777')
      .text(terms, 40, doc.page.height - 78, { width, align: 'center', lineGap: 1.5 });

    doc.end();
  });
}
