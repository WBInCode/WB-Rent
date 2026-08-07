import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import { queries } from '../db.js';
import { sendReturnProtocolEmail } from '../email.js';
import { resolveSettlementLink } from '../payments/routes.js';
import { describeRentalStage } from '../reservation-stage.js';
import { encryptContractData, decryptContractData, sha256 } from './crypto.js';
import {
  PROTOCOL_TEMPLATE_VERSION,
  buildReturnStatements,
  handoverPlace,
  podsumujNaleznosci,
  type HandoverSnapshot,
  type ReturnCharge,
  type ReturnSnapshot,
} from './protocol-template.js';
import { generateReturnPdf } from './return-pdf.js';
import type { ContractSnapshot } from './template.js';

const chargeSchema = z.object({
  kind: z.enum(['cleaning', 'deep_cleaning', 'damage', 'missing', 'penalty', 'other']),
  label: z.string().trim().min(2, 'Opis należności jest za krótki').max(160),
  amount: z.number().min(0, 'Kwota nie może być ujemna').max(100000).nullable(),
  note: z.string().trim().max(400).optional(),
});

export const returnDraftSchema = z.object({
  items: z.array(z.string().trim().min(2).max(200)).min(1, 'Protokół musi zawierać co najmniej jedną pozycję').max(40),
  checklist: z.object({
    complete: z.boolean(),
    working: z.boolean(),
    clean: z.boolean(),
    undamaged: z.boolean(),
  }),
  conditionNotes: z.string().trim().max(2000, 'Uwagi mogą mieć maksymalnie 2000 znaków').default(''),
  charges: z.array(chargeSchema).max(20, 'Maksymalnie 20 pozycji rozliczenia').default([]),
  deposit: z.number().min(0, 'Kaucja nie może być ujemna').max(100000),
  /** Saldo uregulowane gotówką przy ladzie — bez tego mail żądałby zapłaty drugi raz. */
  rozliczonoNaMiejscu: z.boolean().default(false),
  employeeName: z.string().trim().min(3, 'Podaj imię i nazwisko przyjmującego zwrot').max(120),
});

export type ReturnDraftInput = z.infer<typeof returnDraftSchema>;

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
  `WB-R/${new Date().getFullYear()}/${String(reservationId).padStart(6, '0')}/PZ`;

/** Pełna treść protokołu z podsumowaniem rozliczenia i oświadczeniami z niego wynikającymi. */
function zlozSnapshot(baza: Omit<ReturnSnapshot, 'chargesTotal' | 'hasPendingValuation' | 'balance' | 'statements'>): ReturnSnapshot {
  const podsumowanie = podsumujNaleznosci(baza.charges, baza.deposit);
  const zastrzezenia = Object.values(baza.checklist).some((spelniony) => !spelniony) || baza.charges.length > 0;
  return {
    ...baza,
    ...podsumowanie,
    statements: buildReturnStatements(zastrzezenia, podsumowanie.hasPendingValuation),
  };
}

async function buildReturnSnapshot(reservation: any, protocolNumber: string): Promise<ReturnSnapshot> {
  const contract = await queries.getContractByReservationId(reservation.id);
  const contractSnapshot = contract?.snapshot_encrypted
    ? parseSnapshot<ContractSnapshot>(contract.snapshot_encrypted)
    : null;

  const wydanie = await queries.getProtocol(reservation.id, 'handover');
  const wydanieSnapshot = wydanie?.snapshot_encrypted
    ? parseSnapshot<HandoverSnapshot>(wydanie.snapshot_encrypted)
    : null;

  const etap = describeRentalStage(reservation);

  return zlozSnapshot({
    version: PROTOCOL_TEMPLATE_VERSION,
    kind: 'return',
    protocolNumber,
    contractNumber: contract?.contract_number ? String(contract.contract_number) : null,
    handoverProtocolNumber: wydanieSnapshot?.protocolNumber ?? null,
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
    // Zwracamy to, co wydano - lista z Zalacznika nr 1 jest punktem odniesienia.
    items: wydanieSnapshot?.items ?? [],
    checklist: { complete: true, working: true, clean: true, undamaged: true },
    conditionAtHandover: wydanieSnapshot?.conditionNotes ?? contractSnapshot?.rental.conditionNotes ?? '',
    conditionNotes: '',
    charges: [],
    deposit: Number(contractSnapshot?.rental.deposit ?? 0),
    rozliczonoNaMiejscu: false,
    overdueDays: etap.overdueDays,
    employeeName: wydanieSnapshot?.employeeName ?? contractSnapshot?.lessor.representative ?? '',
    edited: false,
  });
}

export async function getOrCreateReturnDraft(reservationId: number) {
  const reservation = await queries.getReservationById(reservationId);
  if (!reservation) throw new Error('Rezerwacja nie istnieje');

  const istniejacy = await queries.getProtocol(reservationId, 'return');
  if (istniejacy) {
    const zapisany = parseSnapshot<ReturnSnapshot>(istniejacy.snapshot_encrypted);
    if (istniejacy.status === 'signed' || zapisany.edited) {
      return { protocol: istniejacy, snapshot: zapisany };
    }
    const swiezy = await buildReturnSnapshot(reservation, zapisany.protocolNumber);
    const protocol = await queries.upsertProtocolDraft({
      reservationId,
      kind: 'return',
      number: swiezy.protocolNumber,
      snapshotEncrypted: encryptContractData(JSON.stringify(swiezy)),
      contentHash: sha256(JSON.stringify(swiezy)),
    });
    return { protocol: protocol ?? istniejacy, snapshot: swiezy };
  }

  const snapshot = await buildReturnSnapshot(reservation, protocolNumberFor(reservationId));
  const protocol = await queries.upsertProtocolDraft({
    reservationId,
    kind: 'return',
    number: snapshot.protocolNumber,
    snapshotEncrypted: encryptContractData(JSON.stringify(snapshot)),
    contentHash: sha256(JSON.stringify(snapshot)),
  });
  if (!protocol) throw new Error('Nie udało się przygotować protokołu zwrotu');
  return { protocol, snapshot };
}

/** Zamyka treść przed podpisem — od tej chwili obie Strony widzą finalny dokument. */
export async function saveReturnDraft(reservationId: number, input: ReturnDraftInput) {
  const dane = returnDraftSchema.parse(input);
  const { protocol, snapshot } = await getOrCreateReturnDraft(reservationId);
  if (protocol.status === 'signed') throw new Error('Protokół zwrotu został już podpisany');

  const zmieniony = zlozSnapshot({
    ...snapshot,
    items: dane.items,
    checklist: dane.checklist,
    conditionNotes: dane.conditionNotes,
    charges: dane.charges as ReturnCharge[],
    deposit: dane.deposit,
    rozliczonoNaMiejscu: dane.rozliczonoNaMiejscu,
    employeeName: dane.employeeName,
    lessor: { ...snapshot.lessor, representative: dane.employeeName },
    edited: true,
  });

  const tresc = JSON.stringify(zmieniony);
  const zapisany = await queries.upsertProtocolDraft({
    reservationId,
    kind: 'return',
    number: zmieniony.protocolNumber,
    snapshotEncrypted: encryptContractData(tresc),
    contentHash: sha256(tresc),
  });
  if (!zapisany) throw new Error('Protokół zwrotu został już podpisany');
  return { protocol: zapisany, snapshot: zmieniony, contentHash: sha256(tresc) };
}

export async function signReturnProtocol(data: {
  reservationId: number;
  contentHash: string;
  staffSignatureDataUrl: string;
  renterSignatureDataUrl: string;
  ip: string;
  userAgent: string;
}) {
  const protocol = await queries.getProtocol(data.reservationId, 'return');
  if (!protocol) throw new Error('Protokół zwrotu nie został przygotowany');
  if (protocol.status === 'signed') throw new Error('Protokół zwrotu został już podpisany');
  if (protocol.content_hash !== data.contentHash) {
    throw new Error('Treść protokołu zmieniła się po wyświetleniu. Wygeneruj dokument jeszcze raz i pokaż go klientowi.');
  }

  const finalny = parseSnapshot<ReturnSnapshot>(protocol.snapshot_encrypted);
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

  const pdf = await generateReturnPdf(finalny, { staff: staffSignature, renter: renterSignature }, audit);
  const pdfHash = sha256(pdf);

  const storageDir = path.resolve(config.contracts.storageDir);
  await fs.mkdir(storageDir, { recursive: true });
  const pdfPath = path.join(storageDir, `protokol-zwrotu-${protocol.id}-${pdfHash.slice(0, 16)}.pdf.enc`);
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
    // Jak przy wydaniu: podpis zamyka dokument, zwrot rejestruje osobny krok.
    reservationStatus: null,
    signedBy: finalny.employeeName,
  });
  if (!podpisany) throw new Error('Protokół został podpisany w innej sesji');

  await queries.registerContractDocument({
    title: `Protokół zwrotu ${finalny.protocolNumber}`,
    reservationId: data.reservationId,
    customerEmail: finalny.renter.email || '',
    documentDate: audit.signedAt.slice(0, 10),
    fileName: `protokol-zwrotu-${finalny.protocolNumber.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
    filePath: pdfPath,
    sizeBytes: pdf.length,
    fileHash: pdfHash,
    notes: 'Protokół zwrotu podpisany elektronicznie przy odbiorze sprzętu.',
  }).catch((error) => console.error('Register return document error:', error));

  // Sam wykaz kwot niczego nie zalatwia - klient musi wiedziec, czy ma jeszcze
  // zaplacic i gdzie kliknac. Doplata idzie osobna platnoscia na kwote salda:
  // link na `total_price` zadalby calego czynszu najmu zamiast roznicy.
  const platnosc = finalny.balance > 0 && !finalny.rozliczonoNaMiejscu
    ? await resolveSettlementLink(
        data.reservationId,
        finalny.balance,
        `Rozliczenie najmu — protokół ${finalny.protocolNumber}`,
        '127.0.0.1'
      ).catch(() => null)
    : null;

  const emailResult = finalny.renter.email
    ? await sendReturnProtocolEmail(finalny.renter.email, finalny.renter.name, finalny.protocolNumber, pdf, {
        chargesTotal: finalny.chargesTotal,
        deposit: finalny.deposit,
        balance: finalny.balance,
        hasPendingValuation: finalny.hasPendingValuation,
        charges: finalny.charges.map((pozycja) => ({
          label: pozycja.note ? `${pozycja.label} — ${pozycja.note}` : pozycja.label,
          amount: pozycja.amount,
        })),
        linkPlatnosci: platnosc?.status === 'ready' ? platnosc.url : null,
        zaplaconoNaMiejscu: Boolean(finalny.rozliczonoNaMiejscu),
      })
    : { delivered: false, transport: 'none' as const };

  return {
    protocolNumber: finalny.protocolNumber,
    pdfHash,
    balance: finalny.balance,
    emailDelivered: emailResult.delivered,
  };
}

export async function readReturnPdf(reservationId: number) {
  const protocol = await queries.getProtocol(reservationId, 'return');
  if (!protocol || protocol.status !== 'signed' || !protocol.pdf_path) return null;
  return {
    buffer: decryptContractData(await fs.readFile(protocol.pdf_path, 'utf8')),
    filename: `protokol-zwrotu-${String(protocol.number).replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
  };
}
