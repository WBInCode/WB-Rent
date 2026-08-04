import PDFDocument from 'pdfkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContractSnapshot } from './template.js';

export interface ContractAuditData {
  signedAt: string;
  signedIp: string;
  signedUserAgent: string;
  contentHash: string;
  renterSignatureHash: string;
  lessorSignatureHash?: string;
}

export interface ContractSignatures {
  renter: Buffer;
  lessor?: Buffer;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const regularFont = path.resolve(
  moduleDir,
  '../../assets/fonts/NotoSans-Regular.ttf'
);
const boldFont = path.resolve(
  moduleDir,
  '../../assets/fonts/NotoSans-Bold.ttf'
);

const money = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`;

export function generateContractPdf(
  snapshot: ContractSnapshot,
  signatures: ContractSignatures,
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
      doc.font('NotoBold').fontSize(9);
      const labelHeight = doc.heightOfString(label, { width: 145 });
      doc.font('Noto');
      const valueHeight = doc.heightOfString(value || '—', { width: pageWidth - 150 });
      const rowHeight = Math.max(18, labelHeight, valueHeight) + 5;
      ensureSpace(rowHeight + 5);
      const y = doc.y;
      doc.font('NotoBold').fontSize(9).fillColor('#555').text(label, doc.page.margins.left, y, { width: 145 });
      doc.font('Noto').fillColor('#111').text(value || '—', doc.page.margins.left + 150, y, { width: pageWidth - 150 });
      doc.y = Math.max(doc.y, y + rowHeight);
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
    row('Adres', snapshot.lessor.address);
    row('NIP', snapshot.lessor.nip);
    row('Reprezentowany przez', snapshot.lessor.representative);
    doc.moveDown(0.4);
    row('Najemca', snapshot.renter.name);
    row('Adres', snapshot.renter.address);
    row('E-mail', snapshot.renter.email);
    row('Telefon', snapshot.renter.phone);
    row('PESEL', snapshot.renter.pesel || 'nie podano');
    if (snapshot.renter.documentNumber) {
      row(
        'Dokument tożsamości',
        `${snapshot.renter.documentType === 'dowod_osobisty' ? 'dowód osobisty' : 'paszport'} ${snapshot.renter.documentNumber}`
      );
    }

    heading('2. DANE NAJMU');
    const rentalItems = snapshot.rental.items?.length
      ? snapshot.rental.items
      : [{ productName: snapshot.rental.productName, itemPrice: snapshot.rental.totalPrice }];
    row(
      rentalItems.length === 1 ? 'Sprzęt' : 'Sprzęt (pozycje)',
      rentalItems.map((item, index) => `${index + 1}. ${item.productName} — ${money(item.itemPrice)}`).join('\n')
    );
    row(
      'Termin',
      snapshot.rental.isIndefinite
        ? `${snapshot.rental.startDate} ${snapshot.rental.startTime} – bezterminowo (do odwołania)`
        : `${snapshot.rental.startDate} ${snapshot.rental.startTime} – ${snapshot.rental.endDate} ${snapshot.rental.endTime} (${snapshot.rental.days} dni)`
    );
    row('Czynsz najmu', money(snapshot.rental.totalPrice));
    row('Kaucja', money(snapshot.rental.deposit));
    row('Odbiór / dostawa', snapshot.rental.delivery ? `dostawa: ${snapshot.rental.deliveryAddress || 'adres zlecenia'}` : 'odbiór osobisty');
    row('Akcesoria', snapshot.rental.accessories);
    row('Stan przy wydaniu', snapshot.rental.conditionNotes);

    heading('3. WARUNKI UMOWY');
    for (const clause of snapshot.clauses) {
      ensureSpace(62);
      doc.font('NotoBold').fontSize(9.5).fillColor('#111').text(`§ ${clause.number}. ${clause.title}`);
      doc.font('Noto').fontSize(8.7).fillColor('#333');
      if (clause.points?.length) {
        clause.points.forEach((point, index) => {
          ensureSpace(26);
          doc.text(`${index + 1}. ${point}`, { align: 'justify', lineGap: 1.5, indent: 8 });
        });
      } else if (clause.text) {
        doc.text(clause.text, { align: 'justify', lineGap: 1.5 });
      }
      doc.moveDown(0.55);
    }

    if (snapshot.handoverItems?.length) {
      ensureSpace(60 + snapshot.handoverItems.length * 14);
      heading('ZAŁĄCZNIK NR 1 — PROTOKÓŁ WYDANIA SPRZĘTU');
      doc.font('Noto').fontSize(8.7).fillColor('#333').text(
        'Najemca potwierdza odbiór wymienionego Sprzętu zgodnie z Umową i zobowiązuje się do jego zwrotu w stanie nieuszkodzonym w terminie wskazanym w §1.',
        { align: 'justify', lineGap: 1.5 }
      );
      doc.moveDown(0.4);
      snapshot.handoverItems.forEach((item, index) => {
        ensureSpace(16);
        doc.font('Noto').fontSize(9).fillColor('#222').text(`${index + 1}.  ${item}`, { indent: 8 });
      });
      doc.moveDown(0.6);
    }

    ensureSpace(250);
    heading('4. OŚWIADCZENIE I PODPISY STRON');
    doc.font('Noto').fontSize(9).fillColor('#222').text(
      'Najemca potwierdza, że przed złożeniem podpisu otrzymał możliwość zapoznania się z całą treścią umowy, dane w umowie są prawidłowe, sprzęt i akcesoria są zgodne z opisem oraz akceptuje wszystkie postanowienia.',
      { align: 'justify' }
    );
    doc.moveDown(0.6);
    const signaturesY = doc.y;
    const gap = 14;
    const boxWidth = (pageWidth - gap) / 2;
    const boxHeight = 128;
    doc.roundedRect(doc.page.margins.left, signaturesY, boxWidth, boxHeight, 5).strokeColor('#b8972a').lineWidth(0.8).stroke();
    doc.roundedRect(doc.page.margins.left + boxWidth + gap, signaturesY, boxWidth, boxHeight, 5).strokeColor('#b8972a').lineWidth(0.8).stroke();
    try {
      if (signatures.lessor) {
        doc.image(signatures.lessor, doc.page.margins.left + 12, signaturesY + 22, {
          fit: [boxWidth - 24, 66], align: 'center', valign: 'center',
        });
      } else {
        doc.font('NotoBold').fontSize(10).fillColor('#555').text(
          snapshot.lessor.representative,
          doc.page.margins.left + 12,
          signaturesY + 50,
          { width: boxWidth - 24, align: 'center' }
        );
      }
      doc.image(signatures.renter, doc.page.margins.left + boxWidth + gap + 12, signaturesY + 22, {
        fit: [boxWidth - 24, 66], align: 'center', valign: 'center',
      });
    } catch (error) {
      reject(error);
      return;
    }
    doc.font('Noto').fontSize(7.5).fillColor('#555');
    doc.text(
      `${snapshot.lessor.representative}\nWynajmujący`,
      doc.page.margins.left + 8,
      signaturesY + 96,
      { width: boxWidth - 16, align: 'center' }
    );
    doc.text(
      `${snapshot.renter.name}\nNajemca`,
      doc.page.margins.left + boxWidth + gap + 8,
      signaturesY + 96,
      { width: boxWidth - 16, align: 'center' }
    );
    doc.y = signaturesY + boxHeight + 16;

    heading('5. METRYKA DOWODOWA DOKUMENTU');
    doc.font('Noto').fontSize(7.5).fillColor('#555');
    row('Czas podpisu', audit.signedAt);
    row('Adres IP', audit.signedIp);
    row('Urządzenie', audit.signedUserAgent.slice(0, 180));
    row('SHA-256 treści', audit.contentHash);
    row('SHA-256 podpisu Najemcy', audit.renterSignatureHash);
    row('SHA-256 podpisu Wynajmującego', audit.lessorSignatureHash || 'podpis imienny — dokument historyczny');
    doc.moveDown(0.6);
    doc.font('Noto').fontSize(7.5).fillColor('#777').text(
      'Dokument wygenerowany automatycznie przez WB-Rent. Integralność treści i podpisu można zweryfikować za pomocą powyższych skrótów kryptograficznych.',
      { align: 'center' }
    );

    // Footer on every buffered page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const originalBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Noto').fontSize(7).fillColor('#888').text(
        `WB Partners Sp. z o.o. • NIP 5170455185 • ${snapshot.contractNumber} • strona ${i + 1}/${range.count}`,
        48,
        doc.page.height - 28,
        { width: pageWidth, align: 'center', lineBreak: false }
      );
      doc.page.margins.bottom = originalBottomMargin;
    }

    doc.end();
  });
}