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

export const contractDetailsSchema = z.object({
  renterAddress: z.string().trim()
    .min(5, 'Adres zamieszkania musi mieć co najmniej 5 znaków')
    .max(300, 'Adres zamieszkania może mieć maksymalnie 300 znaków'),
  documentType: z.enum(['dowod_osobisty', 'paszport'], {
    message: 'Wybierz rodzaj dokumentu',
  }),
  documentNumber: z.string().trim()
    .min(3, 'Numer dokumentu musi mieć co najmniej 3 znaki')
    .max(30, 'Numer dokumentu może mieć maksymalnie 30 znaków')
    .regex(/^[\p{L}\d\s-]+$/u, 'Numer dokumentu może zawierać tylko litery, cyfry, spacje i myślniki'),
  pesel: z.string().trim()
    .regex(/^\d{11}$/, 'PESEL musi składać się dokładnie z 11 cyfr')
    .optional()
    .or(z.literal('')),
  employeeName: z.string().trim()
    .min(3, 'Podaj imię i nazwisko pracownika')
    .max(120, 'Dane pracownika mogą mieć maksymalnie 120 znaków'),
  deposit: z.number()
    .min(0, 'Kaucja nie może być ujemna')
    .max(100000, 'Kaucja jest zbyt wysoka'),
  accessories: z.string().trim()
    .min(2, 'Wpisz wydawane akcesoria lub informację „brak”')
    .max(1000, 'Lista akcesoriów może mieć maksymalnie 1000 znaków'),
  conditionNotes: z.string().trim()
    .min(2, 'Opisz stan sprzętu przy wydaniu')
    .max(1000, 'Opis stanu może mieć maksymalnie 1000 znaków'),
});

export const createContractSchema = contractDetailsSchema.extend({
  reservationId: z.number().int().positive('Nieprawidłowy identyfikator rezerwacji'),
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
  const reservationItems = Array.isArray(reservation.items) && reservation.items.length > 0
    ? reservation.items
    : [{
        product_id: reservation.product_id,
        category_id: reservation.category_id,
        item_price: reservation.base_price,
      }];
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
      items: reservationItems.map((item: any) => ({
        productId: String(item.product_id),
        productName: getProductName(String(item.product_id)),
        categoryId: String(item.category_id),
        itemPrice: Number(item.item_price),
      })),
      startDate: String(reservation.start_date),
      endDate: reservation.end_date ? String(reservation.end_date) : null,
      isIndefinite: Boolean(reservation.is_indefinite),
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
  renterSignatureDataUrl: string;
  lessorSignatureDataUrl: string;
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

  const renterSignature = decodeSignature(data.renterSignatureDataUrl);
  const lessorSignature = decodeSignature(data.lessorSignatureDataUrl);
  const snapshot = parseSnapshot(contract.snapshot_encrypted);
  const signedAt = new Date().toISOString();
  const renterSignatureHash = sha256(renterSignature);
  const lessorSignatureHash = sha256(lessorSignature);
  const audit = {
    signedAt,
    signedIp: data.ip.slice(0, 100),
    signedUserAgent: data.userAgent.slice(0, 500),
    contentHash: contract.content_hash as string,
    renterSignatureHash,
    lessorSignatureHash,
  };
  const pdf = await generateContractPdf(
    snapshot,
    { renter: renterSignature, lessor: lessorSignature },
    audit
  );
  const pdfHash = sha256(pdf);

  const storageDir = path.resolve(config.contracts.storageDir);
  await fs.mkdir(storageDir, { recursive: true });
  const filename = `contract-${contract.id}-${pdfHash.slice(0, 16)}.pdf.enc`;
  const pdfPath = path.join(storageDir, filename);
  // The final PDF also contains identity data, so it is encrypted at rest.
  await fs.writeFile(pdfPath, encryptContractData(pdf), { mode: 0o600 });

  const updated = await queries.markContractSigned({
    id: contract.id,
    renterSignatureEncrypted: encryptContractData(renterSignature),
    renterSignatureHash,
    lessorSignatureEncrypted: encryptContractData(lessorSignature),
    lessorSignatureHash,
    signedName: snapshot.renter.name,
    signedIp: audit.signedIp,
    signedUserAgent: audit.signedUserAgent,
    pdfPath,
    pdfHash,
  });
  if (!updated) throw new Error('Umowa została podpisana w innej sesji');

  // The signed contract belongs in the document archive as well. A failure here
  // must not undo a valid signature, so it is logged rather than thrown.
  await queries.registerContractDocument({
    title: `Umowa najmu ${snapshot.contractNumber}`,
    reservationId: snapshot.rental.reservationId,
    customerEmail: snapshot.renter.email,
    documentDate: audit.signedAt.slice(0, 10),
    fileName: `umowa-${snapshot.contractNumber.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
    filePath: pdfPath,
    sizeBytes: pdf.length,
    fileHash: pdfHash,
  }).catch((error) => console.error('Register contract document error:', error));

  const emailResult = await sendSignedContractEmail(
    snapshot.renter.email,
    snapshot.renter.name,
    snapshot.contractNumber,
    pdf
  );
  if (emailResult.delivered) await queries.markContractEmailed(contract.id);

  return {
    id: contract.id as number,
    reservationId: snapshot.rental.reservationId,
    contractNumber: snapshot.contractNumber,
    pdf,
    pdfHash,
    snapshot,
    emailDelivered: emailResult.delivered,
    emailTransport: emailResult.transport,
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

/**
 * Rebuild a signed PDF from the encrypted immutable snapshot and original
 * signature. The signature time/IP/UA and all evidence hashes remain intact;
 * only the PDF representation and its own hash are replaced.
 */
export async function regenerateSignedContractPdf(id: number, resendEmail = false) {
  const contract = await queries.getContractById(id);
  if (!contract || contract.status !== 'signed' || !contract.pdf_path || !contract.signature_encrypted) {
    throw new Error('Podpisana umowa nie istnieje lub nie ma kompletnego materiału dowodowego');
  }

  const snapshot = parseSnapshot(contract.snapshot_encrypted);
  const renterSignature = decryptContractData(contract.signature_encrypted);
  const lessorSignature = contract.lessor_signature_encrypted
    ? decryptContractData(contract.lessor_signature_encrypted)
    : undefined;
  const pdf = await generateContractPdf(snapshot, { renter: renterSignature, lessor: lessorSignature }, {
    signedAt: new Date(contract.signed_at).toISOString(),
    signedIp: contract.signed_ip || 'unknown',
    signedUserAgent: contract.signed_user_agent || 'unknown',
    contentHash: contract.content_hash,
    renterSignatureHash: contract.signature_hash,
    lessorSignatureHash: contract.lessor_signature_hash || undefined,
  });
  const pdfHash = sha256(pdf);
  await fs.writeFile(contract.pdf_path, encryptContractData(pdf), { mode: 0o600 });
  await queries.refreshContractDocument(contract.pdf_path, sha256(pdf), pdf.length)
    .catch((error) => console.error('Refresh contract document error:', error));
  await queries.updateContractPdfHash(id, pdfHash);

  if (resendEmail) {
    const emailResult = await sendSignedContractEmail(
      snapshot.renter.email,
      snapshot.renter.name,
      snapshot.contractNumber,
      pdf
    );
    if (emailResult.delivered) await queries.markContractEmailed(id);
  }

  return { contractNumber: snapshot.contractNumber, pdfHash, pdf };
}

/**
 * Adds contracts signed before the archive existed (or whose registration
 * failed) to the document list. Idempotent - safe to run on every boot.
 */
export async function backfillContractDocuments() {
  const pending = await queries.getUnarchivedSignedContracts();
  if (pending.length === 0) return 0;

  let registered = 0;
  for (const contract of pending) {
    try {
      const pdf = decryptContractData(await fs.readFile(contract.pdf_path, 'utf8'));
      const signedAt = contract.signed_at ? new Date(contract.signed_at).toISOString().slice(0, 10) : null;
      const added = await queries.registerContractDocument({
        title: `Umowa najmu ${contract.contract_number}`,
        reservationId: contract.reservation_id ?? null,
        customerEmail: contract.customer_email || '',
        documentDate: signedAt,
        fileName: `umowa-${String(contract.contract_number).replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`,
        filePath: contract.pdf_path,
        sizeBytes: pdf.length,
        fileHash: contract.pdf_hash || sha256(pdf),
      });
      if (added) registered += 1;
    } catch (error) {
      console.error(`Nie udało się zarchiwizować umowy ${contract.contract_number}:`, error);
    }
  }

  if (registered > 0) {
    console.log(`📄 Dodano ${registered} podpisanych umów do archiwum dokumentów`);
  }
  return registered;
}

/** Re-send the existing immutable PDF without regenerating or changing its hash. */
export async function resendSignedContractEmail(id: number) {  const contract = await queries.getContractById(id);
  if (!contract || contract.status !== 'signed' || !contract.pdf_path) {
    throw new Error('Podpisana umowa nie istnieje');
  }
  const snapshot = parseSnapshot(contract.snapshot_encrypted);
  const pdf = decryptContractData(await fs.readFile(contract.pdf_path, 'utf8'));
  const currentHash = sha256(pdf);
  if (contract.pdf_hash && currentHash !== contract.pdf_hash) {
    throw new Error('Integralność pliku PDF jest nieprawidłowa — wysyłka została zablokowana');
  }

  const result = await sendSignedContractEmail(
    snapshot.renter.email,
    snapshot.renter.name,
    snapshot.contractNumber,
    pdf
  );
  if (result.delivered) await queries.markContractEmailed(id);

  return {
    delivered: result.delivered,
    transport: result.transport,
    email: snapshot.renter.email,
    contractNumber: snapshot.contractNumber,
  };
}