import PDFDocument from 'pdfkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContractSnapshot } from './template.js';

export interface ContractAuditData {
  signedAt: string;
  signedIp: string;
  signedUserAgent: string;
  contentHash: string;
  signatureHash: string;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const regularFont = path.resolve(
  moduleDir,
  '../../node_modules/@fontsource/noto-sans/files/noto-sans-latin-ext-400-normal.woff'
);
const boldFont = path.resolve(
  moduleDir,
  '../../node_modules/@fontsource/noto-sans/files/noto-sans-latin-ext-700-normal.woff'
);

const money = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`;

export function generateContractPdf(
  snapshot: ContractSnapshot,
  signaturePng: Buffer,
  audit: ContractAuditData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', bufferPages: true, margins: { top: 46, bottom: 50, left: 48, right: 48 }, info: {
      Title: `Umowa najmu ${snapshot.contractNumber}`,
      Author: 'WB-Rent / WB Partners Sp. z o.o.',
      Subject: 'Elektronicznie podpisana umowa najmu sprzętu',
      Keywords: 'WB-Rent, umowa najmu, podpis elektroniczny',
    } });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Noto', regularFont);
    doc.registerFont('NotoBold', boldFont);
    doc.font('Noto');

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const ensureSpace = (height: number) => {
      if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
    };
    const row = (label: string, value: string) => {
      ensureSpace(28);
      const y = doc.y;
      doc.font('NotoBold').fontSize(9).fillColor('#555').text(label, doc.page.margins.left, y, { width: 145 });
      doc.font('Noto').fillColor('#111').text(value || '—', doc.page.margins.left + 150, y, { width: pageWidth - 150 });
      doc.y = Math.max(doc.y, y + 18);
    };
    const heading = (text: string) => {
      ensureSpace(42);
      doc.moveDown(0.5).font('NotoBold').fontSize(12).fillColor('#8b6914').text(text);
      doc.moveDown(0.35);
    };

    // Header
    doc.font('NotoBold').fontSize(23).fillColor('#8b6914').text('WB-Rent', { align: 'center' });
    doc.font('NotoBold').fontSize(15).fillColor('#111').text('UMOWA NAJMU SPRZĘTU', { align: 'center' });
    doc.font('Noto').fontSize(9).fillColor('#666').text(
      `nr ${snapshot.contractNumber}  •  wersja wzoru ${snapshot.templateVersion}`,
      { align: 'center' }
    );
    doc.moveDown(1);
    doc.strokeColor('#b8972a').lineWidth(1).moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).stroke();
    doc.moveDown(0.8);

    heading('1. STRONY UMOWY');
    row('Wynajmujący', snapshot.lessor.name);
    row('Adres / NIP', `${snapshot.lessor.address}, NIP: ${snapshot.lessor.nip}`);
    row('Reprezentowany przez', snapshot.lessor.representative);
    doc.moveDown(0.4);
    row('Najemca', snapshot.renter.name);
    row('Adres', snapshot.renter.address);
    row('E-mail / telefon', `${snapshot.renter.email} / ${snapshot.renter.phone}`);
    row(
      'Dokument tożsamości',
      `${snapshot.renter.documentType === 'dowod_osobisty' ? 'dowód osobisty' : 'paszport'} ${snapshot.renter.documentNumber}${snapshot.renter.pesel ? `, PESEL: ${snapshot.renter.pesel}` : ''}`
    );

    heading('2. DANE NAJMU');
    row('Sprzęt', snapshot.rental.productName);
    row('Termin', `${snapshot.rental.startDate} ${snapshot.rental.startTime} – ${snapshot.rental.endDate} ${snapshot.rental.endTime} (${snapshot.rental.days} dni)`);
    row('Czynsz najmu', money(snapshot.rental.totalPrice));
    row('Kaucja', money(snapshot.rental.deposit));
    row('Odbiór / dostawa', snapshot.rental.delivery ? `dostawa: ${snapshot.rental.deliveryAddress || 'adres zlecenia'}` : 'odbiór osobisty');
    row('Akcesoria', snapshot.rental.accessories);
    row('Stan przy wydaniu', snapshot.rental.conditionNotes);

    heading('3. WARUNKI UMOWY');
    for (const clause of snapshot.clauses) {
      ensureSpace(62);
      doc.font('NotoBold').fontSize(9.5).fillColor('#111').text(`§ ${clause.number}. ${clause.title}`);
      doc.font('Noto').fontSize(8.7).fillColor('#333').text(clause.text, { align: 'justify', lineGap: 1.5 });
      doc.moveDown(0.55);
    }

    ensureSpace(230);
    heading('4. OŚWIADCZENIE I PODPIS NAJEMCY');
    doc.font('Noto').fontSize(9).fillColor('#222').text(
      'Najemca potwierdza, że przed złożeniem podpisu otrzymał możliwość zapoznania się z całą treścią umowy, dane w umowie są prawidłowe, sprzęt i akcesoria są zgodne z opisem oraz akceptuje wszystkie postanowienia.',
      { align: 'justify' }
    );
    doc.moveDown(0.6);
    doc.roundedRect(doc.page.margins.left, doc.y, pageWidth, 112, 5).strokeColor('#b8972a').lineWidth(0.8).stroke();
    try {
      doc.image(signaturePng, doc.page.margins.left + 20, doc.y + 8, { fit: [pageWidth - 40, 72], align: 'center', valign: 'center' });
    } catch (error) {
      reject(error);
      return;
    }
    doc.y += 82;
    doc.font('Noto').fontSize(8).fillColor('#555').text(`${snapshot.renter.name} • podpisano: ${audit.signedAt}`, doc.page.margins.left + 12, doc.y, { width: pageWidth - 24, align: 'center' });
    doc.y += 35;

    heading('5. METRYKA DOWODOWA DOKUMENTU');
    doc.font('Noto').fontSize(7.5).fillColor('#555');
    row('Czas podpisu', audit.signedAt);
    row('Adres IP', audit.signedIp);
    row('Urządzenie', audit.signedUserAgent.slice(0, 180));
    row('SHA-256 treści', audit.contentHash);
    row('SHA-256 podpisu', audit.signatureHash);
    doc.moveDown(0.6);
    doc.font('Noto').fontSize(7.5).fillColor('#777').text(
      'Dokument wygenerowany automatycznie przez WB-Rent. Integralność treści i podpisu można zweryfikować za pomocą powyższych skrótów kryptograficznych.',
      { align: 'center' }
    );

    // Footer on every buffered page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc.font('Noto').fontSize(7).fillColor('#888').text(
        `WB Partners Sp. z o.o. • NIP 5170455185 • ${snapshot.contractNumber} • strona ${i + 1}/${range.count}`,
        48,
        doc.page.height - 32,
        { width: pageWidth, align: 'center', lineBreak: false }
      );
    }

    doc.end();
  });
}