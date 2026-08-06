import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import { queries } from '../db.js';
import { getProductName } from '../products.js';
import { sendHandoverProtocolEmail } from '../email.js';
import { encryptContractData, decryptContractData, sha256 } from './crypto.js';
import { getProductTerms } from './product-terms.js';
import { buildDefaultHandoverItems } from './service.js';
import {
  PROTOCOL_TEMPLATE_VERSION,
  buildHandoverStatements,
  handoverPlace,
  type HandoverSnapshot,
} from './protocol-template.js';
import { generateHandoverPdf } from './protocol-pdf.js';
import type { ContractSnapshot } from './template.js';

export const handoverDraftSchema = z.object({
  items: z.array(
    z.string().trim().min(2, 'Pozycja protokołu jest za krótka').max(200, 'Pozycja może mieć maksymalnie 200 znaków')
  ).min(1, 'Protokół musi zawierać co najmniej jedną pozycję').max(40, 'Protokół może mieć maksymalnie 40 pozycji'),
  conditionNotes: z.string().trim()
    .min(2, 'Opisz stan sprzętu przy wydaniu')
    .max(2000, 'Opis stanu może mieć maksymalnie 2000 znaków'),
  employeeName: z.string().trim()
    .min(3, 'Podaj imię i nazwisko wydającego')
    .max(120, 'Dane wydającego mogą mieć maksymalnie 120 znaków'),
});

export type HandoverDraftInput = z.infer<typeof handoverDraftSchema>;

const PODPIS_PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const decodeSignature = (dataUrl: string): Buffer => {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Nieprawidłowy format podpisu');
  const image = Buffer.from(match[1], 'base64');
  if (image.length < 300 || image.length > 350_000) throw new Error('Nieprawidłowy rozmiar podpisu');
  if (!image.subarray(0, 8).equals(PODPIS_PNG)) throw new Error('Nieprawidłowy format podpisu');
  return image;
};

const parseSnapshot = <T>(encrypted: string): T =>
  JSON.parse(decryptContractData(encrypted).toString('utf8')) as T;

const protocolNumberFor = (reservationId: number): string =>
  `WB-R/${new Date().getFullYear()}/${String(reservationId).padStart(6, '0')}/PW`;

const productIdsOf = (reservation: any): string[] => {
  const items = Array.isArray(reservation.items) && reservation.items.length > 0
    ? reservation.items
    : [{ product_id: reservation.product_id }];
  return items.map((item: any) => String(item.product_id));
};

const manualsLabel = (productIds: string[]): string => {
  const names = [...new Set(productIds.map((id) => getProductTerms(id)?.deviceName || getProductName(id)))];
  return names.length === 1
    ? `instrukcja obsługi urządzenia ${names[0]}`
    : `instrukcje obsługi urządzeń: ${names.join(', ')}`;
};

/**
 * Zwraca protokol wydania gotowy do uzupelnienia. Pozycje i stan sprzetu biore z
 * umowy, zeby pracownik nie przepisywal tego samego drugi raz, ale zostaja
 * edytowalne - przy wydaniu moze byc inaczej niz przy przygotowaniu umowy.
 */
export async function getOrCreateHandoverDraft(reservationId: number) {
  const reservation = await queries.getReservationById(reservationId);
  if (!reservation) throw new Error('Rezerwacja nie istnieje');

  const istniejacy = await queries.getProtocol(reservationId, 'handover');
  if (istniejacy) {
    const zapisany = parseSnapshot<HandoverSnapshot>(istniejacy.snapshot_encrypted);
    // Protokol mozna otworzyc zanim powstanie umowa. Dopoki pracownik niczego nie
    // zmienil, szkic ma nadazac za umowa - inaczej zostalby pusty na zawsze.
    if (istniejacy.status === 'signed' || zapisany.edited) {
      return { protocol: istniejacy, snapshot: zapisany };
    }
    const swiezy = await buildHandoverSnapshot(reservation, zapisany.protocolNumber);
    const protocol = await queries.upsertProtocolDraft({
      reservationId,
      kind: 'handover',
      number: swiezy.protocolNumber,
      snapshotEncrypted: encryptContractData(JSON.stringify(swiezy)),
      contentHash: sha256(JSON.stringify(swiezy)),
    });
    return { protocol: protocol ?? istniejacy, snapshot: swiezy };
  }

  const snapshot = await buildHandoverSnapshot(reservation, protocolNumberFor(reservationId));
  const protocol = await queries.upsertProtocolDraft({
    reservationId,
    kind: 'handover',
    number: snapshot.protocolNumber,
    snapshotEncrypted: encryptContractData(JSON.stringify(snapshot)),
    contentHash: sha256(JSON.stringify(snapshot)),
  });
  if (!protocol) throw new Error('Nie udało się przygotować protokołu wydania');
  return { protocol, snapshot };
}

async function buildHandoverSnapshot(reservation: any, protocolNumber: string): Promise<HandoverSnapshot> {
  const contract = await queries.getContractByReservationId(reservation.id);
  const contractSnapshot = contract?.snapshot_encrypted
    ? parseSnapshot<ContractSnapshot>(contract.snapshot_encrypted)
    : null;

  const productIds = productIdsOf(reservation);
  return {
    version: PROTOCOL_TEMPLATE_VERSION,
    kind: 'handover',
    protocolNumber,
    contractNumber: contract?.contract_number ? String(contract.contract_number) : null,
    createdAt: new Date().toISOString(),
    lessor: contractSnapshot?.lessor ?? {
      name: 'WB Partners Sp. z o.o.',
      address: 'ul. Juliusza Słowackiego 24/11, 35-060 Rzeszów',
      nip: '5170455185',
      representative: '',
    },
    renter: {
      name: reservation.name,
      email: reservation.email,
      phone: reservation.phone,
    },
    rental: {
      reservationId: reservation.id,
      startDate: String(reservation.start_date),
      startTime: reservation.start_time || '09:00',
      endDate: reservation.end_date ? String(reservation.end_date) : null,
      endTime: reservation.end_time || '09:00',
      isIndefinite: Boolean(reservation.is_indefinite),
      days: Number(reservation.days) || 1,
    },
    place: handoverPlace(Boolean(reservation.delivery), reservation.delivery_address),
    items: contractSnapshot?.handoverItems?.length
      ? contractSnapshot.handoverItems
      : buildDefaultHandoverItems(productIds),
    accessories: contractSnapshot?.rental.accessories ?? '',
    conditionNotes: contractSnapshot?.rental.conditionNotes ?? '',
    statements: buildHandoverStatements(manualsLabel(productIds)),
    employeeName: contractSnapshot?.lessor.representative ?? '',
    photoCount: 0,
    edited: false,
  };
}

/**
 * Zamyka tresc protokolu przed podpisem. Od tej chwili dokument jest kompletny:
 * zawiera takze liczbe zdjec i oswiadczenia, ktore z niej wynikaja. Klient musi
 * zobaczyc dokladnie to, pod czym sie podpisze - inaczej podpis jest wadliwy.
 */
export async function saveHandoverDraft(reservationId: number, input: HandoverDraftInput) {
  const dane = handoverDraftSchema.parse(input);
  const { protocol, snapshot } = await getOrCreateHandoverDraft(reservationId);
  if (protocol.status === 'signed') throw new Error('Protokół został już podpisany');

  const reservation = await queries.getReservationById(reservationId);

  const zmieniony: HandoverSnapshot = {
    ...snapshot,
    items: dane.items,
    conditionNotes: dane.conditionNotes,
    employeeName: dane.employeeName,
    lessor: { ...snapshot.lessor, representative: dane.employeeName },
    statements: buildHandoverStatements(manualsLabel(productIdsOf(reservation))),
    edited: true,
  };

  const tresc = JSON.stringify(zmieniony);
  const zapisany = await queries.upsertProtocolDraft({
    reservationId,
    kind: 'handover',
    number: zmieniony.protocolNumber,
    snapshotEncrypted: encryptContractData(tresc),
    contentHash: sha256(tresc),
  });
  if (!zapisany) throw new Error('Protokół został już podpisany');
  return { protocol: zapisany, snapshot: zmieniony, contentHash: sha256(tresc) };
}

/**
 * Podpisuje dokladnie te tresc, ktora zostala wczesniej zapisana i pokazana na
 * ekranie. Zadne dane dokumentu nie przychodza razem z podpisem - przychodzi
 * tylko odcisk tresci, ktora podpisujacy mial przed oczami.
 */
export async function signHandoverProtocol(data: {
  reservationId: number;
  contentHash: string;
  staffSignatureDataUrl: string;
  renterSignatureDataUrl: string;
  ip: string;
  userAgent: string;
}) {
  const protocol = await queries.getProtocol(data.reservationId, 'handover');
  if (!protocol) throw new Error('Protokół nie został przygotowany');
  if (protocol.status === 'signed') throw new Error('Protokół został już podpisany');

  if (protocol.content_hash !== data.contentHash) {
    throw new Error('Treść protokołu zmieniła się po wyświetleniu. Wygeneruj dokument jeszcze raz i pokaż go klientowi.');
  }

  const finalny = parseSnapshot<HandoverSnapshot>(protocol.snapshot_encrypted);
  const staffSignature = decodeSignature(data.staffSignatureDataUrl);
  const renterSignature = decodeSignature(data.renterSignatureDataUrl);

  const audit = {
    signedAt: new Date().toISOString(),
    signedIp: data.ip.slice(0, 100),
    signedUserAgent: data.userAgent.slice(0, 500),
    contentHash: protocol.content_hash as string,
    staffSignatureHash: sha256(staffSignature),
    renterSignatureHash: sha256(renterSignature),
  };

  const pdf = await generateHandoverPdf(finalny, { staff: staffSignature, renter: renterSignature }, audit);
  const pdfHash = sha256(pdf);

  const storageDir = path.resolve(config.contracts.storageDir);
  await fs.mkdir(storageDir, { recursive: true });
  const pdfPath = path.join(storageDir, `protokol-wydania-${protocol.id}-${pdfHash.slice(0, 16)}.pdf.enc`);
  // Protokol zawiera dane osobowe, wiec lezy na dysku zaszyfrowany.
  await fs.writeFile(pdfPath, encryptContractData(pdf), { mode: 0o600 });

  const podpisany = await queries.signProtocol({
    id: protocol.id,
    staffSignatureEncrypted: encryptContractData(staffSignature),
    staffSignatureHash: audit.staffSignatureHash,
    renterSignatureEncrypted: encryptContractData(renterSignature),
    renterSignatureHash: audit.renterSignatureHash,
    signedIp: audit.signedIp,
    signedUserAgent: audit.signedUserAgent,
    pdfPath,
    pdfHash,
    // Podpis zamyka dokument, nie wydanie. Sprzęt opuszcza wypożyczalnię dopiero
    // po zdjęciach i świadomym kliknięciu "Wydaj sprzęt".
    reservationStatus: null,
    signedBy: finalny.employeeName,
  });
  if (!podpisany) throw new Error('Protokół został podpisany w innej sesji');

  await queries.registerContractDocument({
    title: `Protokół wydania ${finalny.protocolNumber}`,
    reservationId: data.reservationId,
    customerEmail: finalny.renter.email || '',
    documentDate: audit.signedAt.slice(0, 10),
    fileName: `protokol-wydania-${finalny.protocolNumber.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
    filePath: pdfPath,
    sizeBytes: pdf.length,
    fileHash: pdfHash,
    notes: 'Protokół wydania podpisany elektronicznie przy wydaniu sprzętu.',
  }).catch((error) => console.error('Register handover document error:', error));

  const emailResult = finalny.renter.email
    ? await sendHandoverProtocolEmail(finalny.renter.email, finalny.renter.name, finalny.protocolNumber, pdf)
    : { delivered: false, transport: 'none' as const };

  return {
    protocolNumber: finalny.protocolNumber,
    pdfHash,
    emailDelivered: emailResult.delivered,
  };
}

export async function readHandoverPdf(reservationId: number) {
  const protocol = await queries.getProtocol(reservationId, 'handover');
  if (!protocol || protocol.status !== 'signed' || !protocol.pdf_path) return null;
  return {
    buffer: decryptContractData(await fs.readFile(protocol.pdf_path, 'utf8')),
    filename: `protokol-wydania-${String(protocol.number).replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
  };
}
