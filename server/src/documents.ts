import crypto from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import multer from 'multer';
import { config } from './config.js';
import { encryptContractData, decryptContractData, sha256 } from './contracts/crypto.js';

const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024;

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_SIZE, files: 1 },
});

/** Handover photos come straight from a phone camera, so they run bigger. */
export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
});

export interface StoredDocument {
  filePath: string;
  fileHash: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
}

/**
 * Magic-byte sniffing — the declared Content-Type from the browser is never
 * trusted, so a renamed executable cannot enter the archive.
 */
export const detectDocumentType = (
  buffer: Buffer
): { mimeType: string; extension: string } | null => {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return null;
};

/** Encrypted at rest (AES-256-GCM) on a private volume, owner-only mode. */
export async function saveDocumentFile(buffer: Buffer): Promise<StoredDocument> {
  const detected = detectDocumentType(buffer);
  if (!detected) {
    throw new Error('Dozwolone są wyłącznie pliki PDF, JPG, PNG lub WebP');
  }

  const storageDir = path.resolve(config.documents.storageDir);
  await fs.mkdir(storageDir, { recursive: true, mode: 0o750 });

  const filename = `${crypto.randomUUID()}.${detected.extension}.enc`;
  const filePath = path.join(storageDir, filename);
  await fs.writeFile(filePath, encryptContractData(buffer), { mode: 0o600 });

  return {
    filePath,
    fileHash: sha256(buffer),
    mimeType: detected.mimeType,
    extension: detected.extension,
    sizeBytes: buffer.length,
  };
}

/** Handover photos are condition evidence - encrypted like every other file. */
export async function savePhotoFile(buffer: Buffer): Promise<StoredDocument> {
  const detected = detectDocumentType(buffer);
  if (!detected || detected.mimeType === 'application/pdf') {
    throw new Error('Zdjęcie musi być plikiem JPG, PNG lub WebP');
  }
  return saveDocumentFile(buffer);
}

export async function readDocumentFile(filePath: string): Promise<Buffer> {
  // Signed contracts stay in the contract store and are only referenced by the
  // archive, so both server-managed roots are readable - nothing else is.
  const allowedRoots = [
    path.resolve(config.documents.storageDir),
    path.resolve(config.contracts.storageDir),
  ];
  const resolved = path.resolve(filePath);
  const allowed = allowedRoots.some(
    (root) => resolved === root || resolved.startsWith(`${root}${path.sep}`)
  );
  if (!allowed) {
    throw new Error('Nieprawidłowa ścieżka dokumentu');
  }
  return decryptContractData(await fs.readFile(resolved, 'utf8'));
}

/**
 * Only files owned by the archive are removable - a document row pointing at a
 * signed contract must never delete the contract itself.
 */
export async function deleteDocumentFile(filePath: string): Promise<void> {
  const storageDir = path.resolve(config.documents.storageDir);
  const resolved = path.resolve(filePath);
  if (resolved !== storageDir && !resolved.startsWith(`${storageDir}${path.sep}`)) return;
  await fs.unlink(resolved).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
}
