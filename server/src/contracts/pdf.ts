import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContractSnapshot } from './template.js';
import { pl } from './typography.js';

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
const regularFont = path.resolve(moduleDir, '../../assets/fonts/NotoSans-Regular.ttf');
const boldFont = path.resolve(moduleDir, '../../assets/fonts/NotoSans-Bold.ttf');
const logoFile = path.resolve(moduleDir, '../../assets/logo/wb-rent-logo.png');

const GOLD = '#8b6914';
const RULE = '#b8972a';
const BODY_SIZE = 9;
const LINE_GAP = 1.6;
/** Column reserved for the "12." / "a)" marker of a hanging-indent list. */
const MARKER_WIDTH = 17;
const SUBLIST_INDENT = 14;

const money = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`;

const polishDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}.${month}.${year}` : value;
};

const documentLabel = (snapshot: ContractSnapshot) =>
  snapshot.renter.documentType === 'dowod_osobisty' ? 'dowodem osobistym' : 'paszportem';

export function generateContractPdf(
  snapshot: ContractSnapshot,
  signatures: ContractSignatures,
  audit: ContractAuditData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: { top: 46, bottom: 54, left: 52, right: 52 },
      info: {
        Title: `Umowa najmu ${snapshot.contractNumber}`,
        Author: 'WB-Rent / WB Partners Sp. z o.o.',
        Subject: 'Elektronicznie podpisana umowa najmu sprzętu',
        Keywords: 'WB-Rent, umowa najmu, podpis elektroniczny',
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

    // Every helper returns the cursor to the left margin. An x offset left behind
    // by one block silently narrows everything rendered after it.
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

    const sectionHeading = (text: string) => {
      ensureSpace(46);
      doc.moveDown(0.4);
      doc.font('NotoBold').fontSize(11.5).fillColor(GOLD)
        .text(pl(text), left, doc.y, { width: contentWidth, align: 'center' });
      doc.moveDown(0.45);
      resetX();
    };

    /** "§1" over its title, both centred. Space is reserved by the caller. */
    const clauseHeading = (number: string, title: string) => {
      doc.moveDown(0.55);
      doc.font('NotoBold').fontSize(10.5).fillColor('#111')
        .text(`§${number}`, left, doc.y, { width: contentWidth, align: 'center' });
      doc.font('NotoBold').fontSize(9.5).fillColor('#111')
        .text(pl(title), left, doc.y, { width: contentWidth, align: 'center' });
      doc.moveDown(0.3);
      resetX();
    };

    const clauseHeadingHeight = (number: string, title: string) => {
      doc.font('NotoBold').fontSize(10.5);
      const numberHeight = doc.heightOfString(`§${number}`, { width: contentWidth, align: 'center' });
      doc.font('NotoBold').fontSize(9.5);
      const titleHeight = doc.heightOfString(pl(title), { width: contentWidth, align: 'center' });
      return numberHeight + titleHeight + 14;
    };

    interface HangingLine {
      marker: string;
      text: string;
      indent: number;
    }

    const lineBodyWidth = (indent: number) => contentWidth - indent - MARKER_WIDTH;

    /** Marker in its own column; every wrapped line of the body stays block-aligned. */
    const hangingLine = ({ marker, text, indent }: HangingLine, reserveSpace: boolean) => {
      const bodyWidth = lineBodyWidth(indent);
      const rendered = pl(text);
      if (reserveSpace) {
        ensureSpace(doc.heightOfString(rendered, { width: bodyWidth, align: 'justify', lineGap: LINE_GAP }));
      }
      const y = doc.y;
      doc.font('Noto').fontSize(BODY_SIZE).fillColor('#333');
      if (marker) doc.text(marker, left + indent, y, { width: MARKER_WIDTH, lineBreak: false });
      doc.text(rendered, left + indent + MARKER_WIDTH, y, {
        width: bodyWidth,
        align: 'justify',
        lineGap: LINE_GAP,
      });
      resetX();
    };

    /** One ustęp; embedded newlines become separate lines, "a) …" becomes a sub-list. */
    const splitPoint = (index: number, point: string): HangingLine[] =>
      point.split('\n').map((line, lineIndex) => {
        const sub = /^([a-z]\))[\u00A0\s]*(.*)$/s.exec(line);
        if (sub) return { marker: sub[1], text: sub[2], indent: SUBLIST_INDENT };
        if (lineIndex === 0) return { marker: `${index + 1}.`, text: line, indent: 0 };
        return { marker: '', text: line, indent: 0 };
      });

    const pointHeight = (lines: HangingLine[]) => {
      doc.font('Noto').fontSize(BODY_SIZE);
      return lines.reduce(
        (total, line) =>
          total +
          doc.heightOfString(pl(line.text), {
            width: lineBodyWidth(line.indent),
            align: 'justify',
            lineGap: LINE_GAP,
          }),
        0
      );
    };

    const usableHeight = () => doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
    const remainingHeight = () => doc.page.height - doc.page.margins.bottom - doc.y;

    /**
     * A numbered point and its a)/b)/c) sub-list are one legal unit - the whole
     * block moves to the next page rather than being cut in half. Only a point
     * taller than a full page is allowed to flow across the break.
     */
    const renderPoint = (lines: HangingLine[], height: number) => {
      const fitsOnAPage = height <= usableHeight();
      if (fitsOnAPage && height > remainingHeight()) {
        doc.addPage();
        resetX();
      }
      lines.forEach((line) => hangingLine(line, !fitsOnAPage));
    };

    const row = (label: string, value: string) => {
      const labelWidth = 148;
      const valueX = left + labelWidth + 8;
      const valueWidth = contentWidth - labelWidth - 8;
      doc.font('NotoBold').fontSize(8.5);
      const labelHeight = doc.heightOfString(label, { width: labelWidth });
      doc.font('Noto');
      const valueHeight = doc.heightOfString(value || '—', { width: valueWidth });
      const rowHeight = Math.max(15, labelHeight, valueHeight) + 4;
      ensureSpace(rowHeight);
      const y = doc.y;
      doc.font('NotoBold').fontSize(8.5).fillColor('#555').text(label, left, y, { width: labelWidth });
      doc.font('Noto').fillColor('#111').text(value || '—', valueX, y, { width: valueWidth });
      doc.y = y + rowHeight;
      resetX();
    };

    const signatureBlock = (
      leftLabel: string,
      leftImage: Buffer | undefined,
      leftFallback: string,
      rightLabel: string,
      rightImage: Buffer
    ) => {
      const boxHeight = 122;
      ensureSpace(boxHeight + 12);
      const top = doc.y;
      const gap = 16;
      const boxWidth = (contentWidth - gap) / 2;
      const rightX = left + boxWidth + gap;

      doc.roundedRect(left, top, boxWidth, boxHeight, 5).strokeColor(RULE).lineWidth(0.8).stroke();
      doc.roundedRect(rightX, top, boxWidth, boxHeight, 5).strokeColor(RULE).lineWidth(0.8).stroke();

      if (leftImage) {
        doc.image(leftImage, left + 12, top + 20, { fit: [boxWidth - 24, 62], align: 'center', valign: 'center' });
      } else {
        doc.font('NotoBold').fontSize(10).fillColor('#555')
          .text(leftFallback, left + 12, top + 46, { width: boxWidth - 24, align: 'center' });
      }
      doc.image(rightImage, rightX + 12, top + 20, { fit: [boxWidth - 24, 62], align: 'center', valign: 'center' });

      doc.font('Noto').fontSize(7.5).fillColor('#555');
      doc.text(leftLabel, left + 8, top + 92, { width: boxWidth - 16, align: 'center' });
      doc.text(rightLabel, rightX + 8, top + 92, { width: boxWidth - 16, align: 'center' });
      doc.y = top + boxHeight + 14;
      resetX();
    };

    // === Header ===
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
      .text('UMOWA NAJMU SPRZĘTU', left, doc.y, { width: contentWidth, align: 'center' });
    doc.font('Noto').fontSize(9).fillColor('#666')
      .text(pl(`nr ${snapshot.contractNumber}`), left, doc.y, { width: contentWidth, align: 'center' });
    doc.moveDown(0.9);
    resetX();
    doc.strokeColor(RULE).lineWidth(1).moveTo(left, doc.y).lineTo(left + contentWidth, doc.y).stroke();
    doc.moveDown(0.9);

    // === Komparycja ===
    body(`Umowa najmu zawarta w dniu ${polishDate(snapshot.generatedAt)} r. w Rzeszowie pomiędzy:`, { align: 'left' });
    doc.moveDown(0.5);
    body([
      `${snapshot.lessor.name} z siedzibą w Rzeszowie,`,
      `${snapshot.lessor.address},`,
      `NIP ${snapshot.lessor.nip},`,
      `reprezentowaną przez: ${snapshot.lessor.representative},`,
      'zwaną dalej „Wynajmującym",',
    ].join('\n'), { align: 'left' });
    doc.moveDown(0.4);
    body('a', { align: 'left' });
    doc.moveDown(0.4);
    body([
      `${snapshot.renter.name},`,
      `zamieszkałym/ą: ${snapshot.renter.address},`,
      snapshot.renter.pesel ? `PESEL ${snapshot.renter.pesel},` : '',
      snapshot.renter.documentNumber
        ? `legitymującym/ą się ${documentLabel(snapshot)} nr ${snapshot.renter.documentNumber},`
        : '',
      `e-mail: ${snapshot.renter.email},`,
      `tel. ${snapshot.renter.phone},`,
      'zwanym/ą dalej „Najemcą",',
    ].filter(Boolean).join('\n'), { align: 'left' });
    doc.moveDown(0.4);
    body('zwanymi dalej łącznie „Stronami", o następującej treści:', { align: 'left' });

    // Contracts signed before v4 kept the rental facts in a separate table
    // instead of inside §1/§2 - historical PDFs must keep showing them.
    if (parseFloat(snapshot.templateVersion) < 4) {
      sectionHeading('DANE NAJMU');
      const legacyItems = snapshot.rental.items?.length
        ? snapshot.rental.items
        : [{ productName: snapshot.rental.productName, itemPrice: snapshot.rental.totalPrice }];
      row(
        legacyItems.length === 1 ? 'Sprzęt' : 'Sprzęt (pozycje)',
        legacyItems.map((item, index) => `${index + 1}. ${item.productName} — ${money(item.itemPrice)}`).join('\n')
      );
      row(
        'Termin',
        snapshot.rental.isIndefinite
          ? `${snapshot.rental.startDate} ${snapshot.rental.startTime} – bezterminowo (do odwołania)`
          : `${snapshot.rental.startDate} ${snapshot.rental.startTime} – ${snapshot.rental.endDate} ${snapshot.rental.endTime} (${snapshot.rental.days} dni)`
      );
      row('Czynsz najmu', money(snapshot.rental.totalPrice));
      row('Kaucja', money(snapshot.rental.deposit));
      row('Odbiór / dostawa', snapshot.rental.delivery
        ? `dostawa: ${snapshot.rental.deliveryAddress || 'adres zlecenia'}`
        : 'odbiór osobisty');
      row('Akcesoria', snapshot.rental.accessories);
      row('Stan przy wydaniu', snapshot.rental.conditionNotes);
      doc.moveDown(0.4);
    }

    // === Clauses ===
    for (const clause of snapshot.clauses) {
      const points = (clause.points ?? []).map((point, index) => {
        const lines = splitPoint(index, point);
        return { lines, height: pointHeight(lines) };
      });
      // The § heading never ends a page on its own - it moves with its first point.
      ensureSpace(clauseHeadingHeight(clause.number, clause.title) + (points[0]?.height ?? 0));
      clauseHeading(clause.number, clause.title);
      if (points.length > 0) points.forEach((point) => renderPoint(point.lines, point.height));
      else if (clause.text) body(clause.text);
    }

    // === Signatures ===
    ensureSpace(230);
    sectionHeading('OŚWIADCZENIE I PODPISY STRON');
    body(
      'Najemca potwierdza, że przed złożeniem podpisu otrzymał możliwość zapoznania się z całą treścią umowy, ' +
      'dane w umowie są prawidłowe, sprzęt i akcesoria są zgodne z opisem oraz akceptuje wszystkie postanowienia.'
    );
    doc.moveDown(0.6);
    try {
      signatureBlock(
        `${snapshot.lessor.representative}\nWynajmujący`,
        signatures.lessor,
        snapshot.lessor.representative,
        `${snapshot.renter.name}\nNajemca`,
        signatures.renter
      );
    } catch (error) {
      reject(error);
      return;
    }

    // Protokół wydania (Załącznik nr 1) jest osobnym dokumentem podpisywanym
    // dopiero przy wydaniu sprzętu. Klient podpisujący umowę zdalnie nie może
    // potwierdzać odbioru czegoś, czego jeszcze nie dostał.

    // === Evidence metadata ===
    ensureSpace(150);
    sectionHeading('METRYKA DOWODOWA DOKUMENTU');
    row('Czas podpisu', audit.signedAt);
    row('Adres IP', audit.signedIp);
    row('Urządzenie', audit.signedUserAgent.slice(0, 180));
    row('SHA-256 treści', audit.contentHash);
    row('SHA-256 podpisu Najemcy', audit.renterSignatureHash);
    row('SHA-256 podpisu Wynajmującego', audit.lessorSignatureHash || 'podpis imienny — dokument historyczny');
    doc.moveDown(0.6);
    doc.font('Noto').fontSize(7.5).fillColor('#777').text(
      'Dokument wygenerowany automatycznie przez WB-Rent. Integralność treści i podpisu można zweryfikować ' +
      'za pomocą powyższych skrótów kryptograficznych.',
      left,
      doc.y,
      { width: contentWidth, align: 'center' }
    );

    // Footer on every buffered page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const originalBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Noto').fontSize(7).fillColor('#888').text(
        `WB Partners Sp. z o.o. • NIP 5170455185 • ${snapshot.contractNumber} • strona ${i + 1}/${range.count}`,
        left,
        doc.page.height - 30,
        { width: contentWidth, align: 'center', lineBreak: false }
      );
      doc.page.margins.bottom = originalBottomMargin;
    }

    doc.end();
  });
}
