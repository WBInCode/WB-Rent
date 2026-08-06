import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pl } from './typography.js';
import { POZYCJE_LISTY, type ReturnSnapshot } from './protocol-template.js';
import type { ProtocolAuditData, ProtocolSignatures } from './protocol-pdf.js';

/** Protokół zwrotu (Załącznik nr 2). Układ i pomocniki jak w protokole wydania. */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const regularFont = path.resolve(moduleDir, '../../assets/fonts/NotoSans-Regular.ttf');
const boldFont = path.resolve(moduleDir, '../../assets/fonts/NotoSans-Bold.ttf');
const logoFile = path.resolve(moduleDir, '../../assets/logo/wb-rent-logo.png');

const GOLD = '#8b6914';
const RULE = '#b8972a';
const BODY_SIZE = 9;
const LINE_GAP = 1.6;
const MARKER_WIDTH = 17;

const money = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`;

const polishDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}.${month}.${year}` : value;
};

const polishDateTime = (iso: string) => {
  const data = new Date(iso);
  const dzien = data.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const godzina = data.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  return `${dzien}, godz. ${godzina}`;
};

const okresNajmu = (rental: ReturnSnapshot['rental']) =>
  rental.isIndefinite || !rental.endDate
    ? `od ${polishDate(rental.startDate)} r., godz. ${rental.startTime} — najem bezterminowy`
    : `od ${polishDate(rental.startDate)} r., godz. ${rental.startTime} do ${polishDate(rental.endDate)} r., godz. ${rental.endTime}`;

export function generateReturnPdf(
  snapshot: ReturnSnapshot,
  signatures: ProtocolSignatures,
  audit: ProtocolAuditData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: { top: 46, bottom: 54, left: 52, right: 52 },
      info: {
        Title: `Protokół zwrotu ${snapshot.protocolNumber}`,
        Author: 'WB-Rent / WB Partners Sp. z o.o.',
        Subject: 'Protokół zwrotu sprzętu — załącznik nr 2 do umowy najmu',
        Keywords: 'WB-Rent, protokół zwrotu, podpis elektroniczny',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Noto', regularFont);
    doc.registerFont('NotoBold', boldFont);
    doc.font('Noto');

    const left = doc.page.margins.left;
    const contentWidth = doc.page.width - left - doc.page.margins.right;

    const resetX = () => {
      doc.x = left;
    };
    const ensureSpace = (height: number) => {
      if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
      resetX();
    };

    const body = (text: string, options: PDFKit.Mixins.TextOptions = {}) => {
      const rendered = pl(text);
      const height = doc.heightOfString(rendered, { width: contentWidth, lineGap: LINE_GAP, ...options });
      ensureSpace(Math.min(height, 40));
      doc.font('Noto').fontSize(BODY_SIZE).fillColor('#222').text(rendered, left, doc.y, {
        width: contentWidth,
        align: 'justify',
        lineGap: LINE_GAP,
        ...options,
      });
      resetX();
    };

    const sectionHeading = (text: string, reserveBelow = 0) => {
      ensureSpace(46 + reserveBelow);
      doc.moveDown(0.5);
      doc.font('NotoBold').fontSize(11).fillColor(GOLD)
        .text(pl(text), left, doc.y, { width: contentWidth, align: 'center' });
      doc.moveDown(0.45);
      resetX();
    };

    const row = (label: string, value: string, wyroznij = false) => {
      const labelWidth = 148;
      const valueX = left + labelWidth + 8;
      const valueWidth = contentWidth - labelWidth - 8;
      doc.font('NotoBold').fontSize(8.5);
      const labelHeight = doc.heightOfString(label, { width: labelWidth });
      doc.font(wyroznij ? 'NotoBold' : 'Noto');
      const rendered = pl(value || '—');
      const valueHeight = doc.heightOfString(rendered, { width: valueWidth });
      const rowHeight = Math.max(15, labelHeight, valueHeight) + 4;
      ensureSpace(rowHeight);
      const y = doc.y;
      doc.font('NotoBold').fontSize(8.5).fillColor('#555').text(label, left, y, { width: labelWidth });
      doc.font(wyroznij ? 'NotoBold' : 'Noto').fillColor(wyroznij ? '#111' : '#111')
        .text(rendered, valueX, y, { width: valueWidth });
      doc.y = y + rowHeight;
      resetX();
    };

    const listItem = (marker: string, text: string) => {
      const rendered = pl(text);
      const textWidth = contentWidth - MARKER_WIDTH;
      doc.font('Noto').fontSize(BODY_SIZE);
      const height = doc.heightOfString(rendered, { width: textWidth, lineGap: LINE_GAP });
      ensureSpace(height + 3);
      const y = doc.y;
      doc.fillColor('#222').text(marker, left, y, { width: MARKER_WIDTH });
      doc.text(rendered, left + MARKER_WIDTH, y, { width: textWidth, align: 'justify', lineGap: LINE_GAP });
      doc.y = y + height + 3;
      resetX();
    };

    /** Wiersz należności: opis po lewej, kwota wyrównana do prawej. */
    const naleznosc = (opis: string, kwota: string, pogrubione = false) => {
      const kwotaWidth = 110;
      const opisWidth = contentWidth - kwotaWidth - 8;
      const font = pogrubione ? 'NotoBold' : 'Noto';
      doc.font(font).fontSize(BODY_SIZE);
      const height = Math.max(doc.heightOfString(pl(opis), { width: opisWidth }), 13) + 3;
      ensureSpace(height);
      const y = doc.y;
      doc.font(font).fillColor('#111').text(pl(opis), left, y, { width: opisWidth });
      doc.font(font).fillColor('#111').text(pl(kwota), left + opisWidth + 8, y, { width: kwotaWidth, align: 'right' });
      doc.y = y + height;
      resetX();
    };

    const signatureBlock = (leftLabel: string, leftImage: Buffer, rightLabel: string, rightImage: Buffer) => {
      const boxHeight = 122;
      ensureSpace(boxHeight + 12);
      const top = doc.y;
      const gap = 16;
      const boxWidth = (contentWidth - gap) / 2;
      const rightX = left + boxWidth + gap;

      doc.roundedRect(left, top, boxWidth, boxHeight, 5).strokeColor(RULE).lineWidth(0.8).stroke();
      doc.roundedRect(rightX, top, boxWidth, boxHeight, 5).strokeColor(RULE).lineWidth(0.8).stroke();
      doc.image(leftImage, left + 12, top + 20, { fit: [boxWidth - 24, 62], align: 'center', valign: 'center' });
      doc.image(rightImage, rightX + 12, top + 20, { fit: [boxWidth - 24, 62], align: 'center', valign: 'center' });

      doc.font('Noto').fontSize(7.5).fillColor('#555');
      doc.text(pl(leftLabel), left + 8, top + 92, { width: boxWidth - 16, align: 'center' });
      doc.text(pl(rightLabel), rightX + 8, top + 92, { width: boxWidth - 16, align: 'center' });
      doc.y = top + boxHeight + 14;
      resetX();
    };

    // === Naglowek ===
    if (fs.existsSync(logoFile)) {
      const logoWidth = 128;
      doc.image(logoFile, left + (contentWidth - logoWidth) / 2, doc.y, { width: logoWidth });
      doc.y += logoWidth * 0.532 + 12;
    } else {
      doc.font('NotoBold').fontSize(22).fillColor(GOLD)
        .text('WB-Rent', left, doc.y, { width: contentWidth, align: 'center' });
      doc.moveDown(0.3);
    }
    resetX();
    doc.font('NotoBold').fontSize(15).fillColor('#111')
      .text('PROTOKÓŁ ZWROTU SPRZĘTU', left, doc.y, { width: contentWidth, align: 'center' });
    doc.font('Noto').fontSize(9).fillColor('#666')
      .text(pl(`nr ${snapshot.protocolNumber}`), left, doc.y, { width: contentWidth, align: 'center' });
    if (snapshot.contractNumber) {
      doc.font('Noto').fontSize(8.5).fillColor('#666')
        .text(pl(`Załącznik nr 2 do umowy najmu nr ${snapshot.contractNumber}`), left, doc.y, {
          width: contentWidth,
          align: 'center',
        });
    }
    doc.moveDown(0.9);
    resetX();
    doc.strokeColor(RULE).lineWidth(1).moveTo(left, doc.y).lineTo(left + contentWidth, doc.y).stroke();
    doc.moveDown(0.9);

    body(`Zwrot Sprzętu nastąpił ${polishDateTime(audit.signedAt)} w obecności obu Stron.`, { align: 'left' });

    // === Strony ===
    sectionHeading('STRONY');
    row('Wynajmujący', [
      snapshot.lessor.name,
      snapshot.lessor.address || '',
      snapshot.lessor.nip ? `NIP ${snapshot.lessor.nip}` : '',
      snapshot.lessor.representative ? `przyjmujący zwrot: ${snapshot.lessor.representative}` : '',
    ].filter(Boolean).join('\n'));
    row('Najemca', [
      snapshot.renter.name,
      snapshot.renter.email ? `e-mail: ${snapshot.renter.email}` : '',
      snapshot.renter.phone ? `tel. ${snapshot.renter.phone}` : '',
    ].filter(Boolean).join('\n'));

    // === Przedmiot zwrotu ===
    sectionHeading('PRZEDMIOT ZWROTU');
    row('Rezerwacja', `nr ${snapshot.rental.reservationId}`);
    row('Okres najmu', okresNajmu(snapshot.rental));
    row('Miejsce zwrotu', snapshot.place);
    if (snapshot.handoverProtocolNumber) {
      row('Protokół wydania', `nr ${snapshot.handoverProtocolNumber}`);
    }
    if (snapshot.overdueDays > 0) {
      row('Opóźnienie zwrotu', `${snapshot.overdueDays} rozpoczętych dób ponad termin`, true);
    }
    doc.moveDown(0.3);

    doc.font('NotoBold').fontSize(9).fillColor('#111')
      .text('Zwrócony sprzęt i osprzęt:', left, doc.y, { width: contentWidth });
    doc.moveDown(0.25);
    resetX();
    snapshot.items.forEach((item, index) => listItem(`${index + 1}.`, item));

    // === Ocena stanu ===
    sectionHeading('OCENA STANU PRZY ZWROCIE');
    POZYCJE_LISTY.forEach(({ klucz, etykieta }) => {
      const spelniony = snapshot.checklist[klucz];
      // Bez znaczkow typu "✓" - font nie ma tych glifow i wychodza puste kwadraty.
      naleznosc(etykieta, spelniony ? 'tak' : 'NIE', !spelniony);
    });
    doc.moveDown(0.4);
    row('Stan przy wydaniu', snapshot.conditionAtHandover || '—');
    doc.moveDown(0.2);
    doc.font('NotoBold').fontSize(9).fillColor('#111')
      .text('Uwagi przy zwrocie:', left, doc.y, { width: contentWidth });
    doc.moveDown(0.2);
    resetX();
    body(snapshot.conditionNotes || 'Brak uwag.', { align: 'left' });
    doc.moveDown(0.2);
    row('Dokumentacja zdjęciowa', 'zdjęcia stanu Sprzętu wykonane przy zwrocie, przechowywane w dokumentacji najmu');

    // === Rozliczenie ===
    sectionHeading('ROZLICZENIE');
    if (snapshot.charges.length === 0) {
      body('Nie stwierdzono podstaw do naliczenia jakichkolwiek należności.', { align: 'left' });
    } else {
      snapshot.charges.forEach((pozycja) => {
        const opis = pozycja.note ? `${pozycja.label} — ${pozycja.note}` : pozycja.label;
        naleznosc(opis, pozycja.amount === null ? 'do wyceny' : money(pozycja.amount));
      });
      doc.moveDown(0.2);
      doc.strokeColor('#ccc').lineWidth(0.6).moveTo(left, doc.y).lineTo(left + contentWidth, doc.y).stroke();
      doc.moveDown(0.3);
      naleznosc('Razem należności', money(snapshot.chargesTotal), true);
    }

    doc.moveDown(0.2);
    naleznosc('Kaucja wpłacona', money(snapshot.deposit));
    doc.moveDown(0.2);
    doc.strokeColor('#ccc').lineWidth(0.6).moveTo(left, doc.y).lineTo(left + contentWidth, doc.y).stroke();
    doc.moveDown(0.3);
    if (snapshot.balance > 0) {
      naleznosc('Do dopłaty przez Najemcę', money(snapshot.balance), true);
    } else if (snapshot.balance < 0) {
      naleznosc('Do zwrotu Najemcy z kaucji', money(Math.abs(snapshot.balance)), true);
    } else {
      naleznosc('Do rozliczenia', money(0), true);
    }

    if (snapshot.hasPendingValuation) {
      doc.moveDown(0.3);
      body(
        'Kwoty oznaczone jako „do wyceny” zostaną wskazane po otrzymaniu faktury z autoryzowanego serwisu i doliczone do powyższego rozliczenia.',
        { align: 'left' }
      );
    }

    // === Oswiadczenia ===
    sectionHeading('OŚWIADCZENIA');
    snapshot.statements.forEach((statement, index) => listItem(`${index + 1}.`, statement));

    // === Podpisy ===
    sectionHeading('PODPISY', 134);
    signatureBlock(
      `Wynajmujący — ${snapshot.employeeName}`,
      signatures.staff,
      `Najemca — ${snapshot.renter.name}`,
      signatures.renter
    );

    // === Metryka dowodowa ===
    ensureSpace(74);
    doc.font('NotoBold').fontSize(8).fillColor('#555')
      .text('Metryka dowodowa', left, doc.y, { width: contentWidth });
    doc.moveDown(0.2);
    doc.font('Noto').fontSize(7).fillColor('#777').text(
      pl([
        `Podpisano: ${polishDateTime(audit.signedAt)} (${audit.signedAt})`,
        `Adres IP urządzenia: ${audit.signedIp}`,
        `Przeglądarka: ${audit.signedUserAgent}`,
        `SHA-256 treści protokołu: ${audit.contentHash}`,
        `SHA-256 podpisu Wynajmującego: ${audit.staffSignatureHash}`,
        `SHA-256 podpisu Najemcy: ${audit.renterSignatureHash}`,
      ].join('\n')),
      left,
      doc.y,
      { width: contentWidth, lineGap: 1.2 }
    );

    // === Stopka ===
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const dolnyMargines = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Noto').fontSize(7).fillColor('#888').text(
        pl(`WB Partners Sp. z o.o. • ${snapshot.protocolNumber} • strona ${i - range.start + 1}/${range.count}`),
        left,
        doc.page.height - 30,
        { width: contentWidth, align: 'center', lineBreak: false }
      );
      doc.page.margins.bottom = dolnyMargines;
    }

    doc.end();
  });
}
