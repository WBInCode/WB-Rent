import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pl } from './typography.js';
import { NAZWA_FIRMY, ADRES_FIRMY } from '../rental-details.js';

/**
 * Aneks przedłużenia to system-owy dokument, nie interaktywny podpis: zgodnie
 * z §5 ust. 3 umowy wchodzi w życie automatycznie z chwilą zaksięgowania
 * wpłaty, więc nie ma tu pól na odręczny podpis — dowodem jest zaksięgowana
 * płatność, którą PDF cytuje w metryce na dole.
 */
export interface ExtensionAnnexData {
  number: string;
  contractNumber: string | null;
  renterName: string;
  productNames: string;
  previousEndDate: string;
  previousEndTime: string;
  previousTotal: number;
  newEndDate: string;
  newEndTime: string;
  newTotal: number;
  surcharge: number;
  paidAt: string;
  paymentSessionId: string;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const regularFont = path.resolve(moduleDir, '../../assets/fonts/NotoSans-Regular.ttf');
const boldFont = path.resolve(moduleDir, '../../assets/fonts/NotoSans-Bold.ttf');
const logoFile = path.resolve(moduleDir, '../../assets/logo/wb-rent-logo.png');

const GOLD = '#8b6914';
const RULE = '#b8972a';

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

export function generateExtensionAnnexPdf(data: ExtensionAnnexData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 46, bottom: 54, left: 52, right: 52 },
      info: {
        Title: `Aneks ${data.number}`,
        Author: 'WB-Rent / WB Partners Sp. z o.o.',
        Subject: 'Aneks przedłużenia najmu sprzętu',
        Keywords: 'WB-Rent, aneks, przedłużenie najmu',
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
    const resetX = () => { doc.x = left; };

    const body = (text: string) => {
      doc.font('Noto').fontSize(9).fillColor('#222')
        .text(pl(text), left, doc.y, { width: contentWidth, align: 'justify', lineGap: 1.6 });
      resetX();
    };

    const sectionHeading = (text: string) => {
      doc.moveDown(0.5);
      doc.font('NotoBold').fontSize(11).fillColor(GOLD)
        .text(pl(text), left, doc.y, { width: contentWidth, align: 'center' });
      doc.moveDown(0.45);
      resetX();
    };

    const row = (label: string, value: string) => {
      const labelWidth = 148;
      const valueX = left + labelWidth + 8;
      const valueWidth = contentWidth - labelWidth - 8;
      const y = doc.y;
      doc.font('NotoBold').fontSize(8.5).fillColor('#555').text(label, left, y, { width: labelWidth });
      doc.font('Noto').fillColor('#111').text(pl(value || '—'), valueX, y, { width: valueWidth });
      doc.y = Math.max(doc.y, y + 15);
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
      .text('ANEKS DO UMOWY NAJMU', left, doc.y, { width: contentWidth, align: 'center' });
    doc.font('Noto').fontSize(9).fillColor('#666')
      .text(pl(`nr ${data.number}`), left, doc.y, { width: contentWidth, align: 'center' });
    if (data.contractNumber) {
      doc.font('Noto').fontSize(8.5).fillColor('#666')
        .text(pl(`do umowy najmu nr ${data.contractNumber}`), left, doc.y, { width: contentWidth, align: 'center' });
    }
    doc.moveDown(0.9);
    resetX();
    doc.strokeColor(RULE).lineWidth(1).moveTo(left, doc.y).lineTo(left + contentWidth, doc.y).stroke();
    doc.moveDown(0.9);

    body(
      `Niniejszy aneks przedłuża okres najmu Sprzętu (${data.productNames}) opisany w umowie najmu` +
      `${data.contractNumber ? ` nr ${data.contractNumber}` : ''} zawartej pomiędzy ${NAZWA_FIRMY} (Wynajmujący) ` +
      `a ${data.renterName} (Najemca).`
    );

    sectionHeading('ZMIANA WARUNKÓW NAJMU');
    row('Dotychczasowy termin zwrotu', `${polishDate(data.previousEndDate)} r., godz. ${data.previousEndTime}`);
    row('Nowy termin zwrotu', `${polishDate(data.newEndDate)} r., godz. ${data.newEndTime}`);
    row('Dotychczasowa wartość najmu', money(data.previousTotal));
    row('Wartość najmu po zmianie', money(data.newTotal));
    row('Dopłata', money(data.surcharge));

    sectionHeading('WEJŚCIE W ŻYCIE');
    body(
      `Zgodnie z §5 ust. 3 umowy najmu, niniejszy aneks wchodzi w życie automatycznie, bez konieczności ` +
      `składania dodatkowych oświadczeń przez Strony, z chwilą zaksięgowania wpłaty dopłaty wskazanej powyżej. ` +
      `Wpłatę zaksięgowano dnia ${polishDateTime(data.paidAt)}.`
    );

    // === Metryka dowodowa ===
    doc.moveDown(0.6);
    doc.font('NotoBold').fontSize(8).fillColor('#555')
      .text('Metryka dowodowa', left, doc.y, { width: contentWidth });
    doc.moveDown(0.2);
    doc.font('Noto').fontSize(7).fillColor('#777').text(
      pl([
        `Wygenerowano: ${polishDateTime(new Date().toISOString())}`,
        `Zaksięgowana wpłata: ${polishDateTime(data.paidAt)}`,
        `Identyfikator płatności: ${data.paymentSessionId}`,
      ].join('\n')),
      left,
      doc.y,
      { width: contentWidth, lineGap: 1.2 }
    );

    // === Stopka ===
    const dolnyMargines = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Noto').fontSize(7).fillColor('#888').text(
      pl(`${NAZWA_FIRMY} • ${ADRES_FIRMY} • ${data.number}`),
      left,
      doc.page.height - 30,
      { width: contentWidth, align: 'center', lineBreak: false }
    );
    doc.page.margins.bottom = dolnyMargines;

    doc.end();
  });
}
