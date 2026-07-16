import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import { queries } from '../db.js';
import { getProductName } from '../products.js';
import { sendSignedContractEmail } from '../email.js';
import { encryptContractData, decryptContractData, randomSigningToken, sha256, signingTokenHash } from './crypto.js';
import { CONTRACT_TEMPLATE_VERSION, contractClauses, type ContractSnapshot } from './template.js';
import { generateContractPdf } from './pdf.js';

export const createContractSchema = z.object({
  reservationId: z.number().int().positive(),
  renterAddress: z.string().trim().min(5).max(300),
  documentType: z.enum(['dowod_osobisty', 'paszport']),
  documentNumber: z.string().trim().min(3).max(30).regex(/^[\p{L}\d\s-]+$/u),
  pesel: z.string().trim().regex(/^\d{11}$/).optional().or(z.literal('')),
  employeeName: z.string().trim().min(3).max(120),
  deposit: z.number().min(0).max(100000),
  accessories: z.string().trim().min(2).max(1000),
  conditionNotes: z.string().trim().min(2).max(1000),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;

const parseSnapshot = (encrypted: string): ContractSnapshot =>
  JSON.parse(decryptContractData(encrypted).toString('utf8')) as ContractSnapshot;

const contractNumberFor = (reservationId: number): string =>
  `WB-R/${new Date().getFullYear()}/${String(reservationId).padStart(6, '0')}`;

export async function createContractSession(input: CreateContractInput) {
  if (!config.contracts.enabled) throw new Error('System umów jest wyłączony');
  const data = createContractSchema.parse(input);
  const reservation = await queries.getReservationById(data.reservationId);
  if (!reservation) throw new Error('Rezerwacja nie istnieje');
  if (['rejected', 'cancelled', 'completed'].includes(reservation.status)) {
    throw new Error('Dla tej rezerwacji nie można przygotować umowy');
  }

  const existing = await queries.getContractByReservationId(data.reservationId);
  if (existing?.status === 'signed') throw new Error('Umowa dla tej rezerwacji jest już podpisana');

  const contractNumber = contractNumberFor(data.reservationId);
  const snapshot: ContractSnapshot = {
    contractNumber,
    templateVersion: CONTRACT_TEMPLATE_VERSION,
    generatedAt: new Date().toISOString(),
    lessor: {
      name: 'WB Partners Sp. z o.o.',
      address: 'ul. Juliusza Słowackiego 24/11, 35-060 Rzeszów',
      nip: '5170455185',
      representative: data.employeeName,
    },
    renter: {
      name: reservation.name,
      email: reservation.email,
      phone: reservation.phone,
      address: data.renterAddress,
      documentType: data.documentType,
      documentNumber: data.documentNumber.toUpperCase(),
      pesel: data.pesel || undefined,
    },
    rental: {
      reservationId: reservation.id,
      productId: reservation.product_id,
      productName: getProductName(reservation.product_id),
      startDate: String(reservation.start_date),
      endDate: String(reservation.end_date),
      startTime: reservation.start_time || '09:00',
      endTime: reservation.end_time || '09:00',
      days: reservation.days,
      totalPrice: Number(reservation.total_price),
      deposit: data.deposit,
      delivery: Boolean(reservation.delivery),
      deliveryAddress: reservation.delivery ? reservation.address : undefined,
      accessories: data.accessories,
      conditionNotes: data.conditionNotes,
    },
    clauses: contractClauses,
  };

  const serialized = JSON.stringify(snapshot);
  const token = randomSigningToken();
  const expiresAt = new Date(Date.now() + config.contracts.signingTtlHours * 60 * 60 * 1000);
  const contract = await queries.upsertContractSession({
    reservationId: reservation.id,
    contractNumber,
    templateVersion: snapshot.templateVersion,
    snapshotEncrypted: encryptContractData(serialized),
    contentHash: sha256(serialized),
    signingTokenHash: signingTokenHash(token),
    signingExpiresAt: expiresAt,
  });

  return {
    id: contract.id as number,
    contractNumber,
    token,
    expiresAt: expiresAt.toISOString(),
    signingUrl: `${config.siteUrl}/podpis/${token}`,
  };
}

export async function getContractPreview(token: string) {
  const contract = await queries.getContractByTokenHash(signingTokenHash(token));
  if (!contract) return null;
  if (new Date(contract.signing_expires_at).getTime() < Date.now()) {
    return { expired: true as const, status: contract.status as string };
  }
  return {
    expired: false as const,
    id: contract.id as number,
    status: contract.status as string,
    contentHash: contract.content_hash as string,
    signedAt: contract.signed_at as string | null,
    snapshot: parseSnapshot(contract.snapshot_encrypted),
  };
}

const decodeSignature = (dataUrl: string): Buffer => {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('Podpis musi być obrazem PNG');
  const image = Buffer.from(match[1], 'base64');
  if (image.length < 300 || image.length > 350_000) throw new Error('Nieprawidłowy rozmiar podpisu');
  if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('Nieprawidłowy format podpisu');
  }
  return image;
};

export async function signContract(data: {
  token: string;
  signatureDataUrl: string;
  accepted: boolean;
  ip: string;
  userAgent: string;
}) {
  if (!data.accepted) throw new Error('Wymagana jest akceptacja pełnej treści umowy');
  const contract = await queries.getContractByTokenHash(signingTokenHash(data.token));
  if (!contract) throw new Error('Sesja podpisu nie istnieje');
  if (contract.status === 'signed') throw new Error('Umowa została już podpisana');
  if (contract.status !== 'ready') throw new Error('Umowa nie jest gotowa do podpisu');
  if (new Date(contract.signing_expires_at).getTime() < Date.now()) throw new Error('Sesja podpisu wygasła');

  const signature = decodeSignature(data.signatureDataUrl);
  const snapshot = parseSnapshot(contract.snapshot_encrypted);
  const signedAt = new Date().toISOString();
  const signatureHash = sha256(signature);
  const audit = {
    signedAt,
    signedIp: data.ip.slice(0, 100),
    signedUserAgent: data.userAgent.slice(0, 500),
    contentHash: contract.content_hash as string,
    signatureHash,
  };
  const pdf = await generateContractPdf(snapshot, signature, audit);
  const pdfHash = sha256(pdf);

  const storageDir = path.resolve(config.contracts.storageDir);
  await fs.mkdir(storageDir, { recursive: true });
  const filename = `contract-${contract.id}-${pdfHash.slice(0, 16)}.pdf.enc`;
  const pdfPath = path.join(storageDir, filename);
  // The final PDF also contains identity data, so it is encrypted at rest.
  await fs.writeFile(pdfPath, encryptContractData(pdf), { mode: 0o600 });

  const updated = await queries.markContractSigned({
    id: contract.id,
    signatureEncrypted: encryptContractData(signature),
    signatureHash,
    signedName: snapshot.renter.name,
    signedIp: audit.signedIp,
    signedUserAgent: audit.signedUserAgent,
    pdfPath,
    pdfHash,
  });
  if (!updated) throw new Error('Umowa została podpisana w innej sesji');

  const emailResult = await sendSignedContractEmail(
    snapshot.renter.email,
    snapshot.renter.name,
    snapshot.contractNumber,
    pdf
  );
  if (emailResult.success) await queries.markContractEmailed(contract.id);

  return {
    id: contract.id as number,
    reservationId: snapshot.rental.reservationId,
    contractNumber: snapshot.contractNumber,
    pdf,
    pdfHash,
    snapshot,
  };
}

export async function readSignedContractPdfByToken(token: string) {
  const contract = await queries.getContractByTokenHash(signingTokenHash(token));
  if (!contract || contract.status !== 'signed' || !contract.pdf_path) return null;
  if (new Date(contract.signing_expires_at).getTime() < Date.now()) return null;
  return {
    buffer: decryptContractData(await fs.readFile(contract.pdf_path, 'utf8')),
    filename: `umowa-${String(contract.contract_number).replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
  };
}

export async function readSignedContractPdfById(id: number) {
  const contract = await queries.getContractById(id);
  if (!contract || contract.status !== 'signed' || !contract.pdf_path) return null;
  return {
    buffer: decryptContractData(await fs.readFile(contract.pdf_path, 'utf8')),
    filename: `umowa-${String(contract.contract_number).replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
  };
}