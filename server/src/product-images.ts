import crypto from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import multer from 'multer';
import { config } from './config.js';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
});

const detectImageExtension = (buffer: Buffer): 'jpg' | 'png' | 'webp' | null => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'webp';
  return null;
};

export async function saveProductImage(buffer: Buffer): Promise<string> {
  const extension = detectImageExtension(buffer);
  if (!extension) throw new Error('Dozwolone są wyłącznie prawidłowe pliki JPG, PNG lub WebP');

  await fs.mkdir(config.productImages.storageDir, { recursive: true, mode: 0o750 });
  const filename = `${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(config.productImages.storageDir, filename), buffer, { mode: 0o640 });
  return `/api/product-images/${filename}`;
}

export async function deleteProductImage(filename: string): Promise<void> {
  const safeName = path.basename(filename);
  if (safeName !== filename || !/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(safeName)) {
    throw new Error('Nieprawidłowa nazwa pliku');
  }
  await fs.unlink(path.join(config.productImages.storageDir, safeName)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
}
