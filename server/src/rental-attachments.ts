import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getProductTerms } from './contracts/product-terms.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const manualsDir = path.resolve(moduleDir, '../assets/manuals');

export interface Attachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

const readAsset = async (fileName: string): Promise<Buffer | null> => {
  const resolved = path.resolve(manualsDir, fileName);
  if (!resolved.startsWith(`${manualsDir}${path.sep}`)) return null;
  return fs.readFile(resolved).catch(() => null);
};

/** Diacritics are folded rather than dropped, so "Kärcher Puzzi 10/1" stays readable. */
const asciiFileName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w .,-]+/g, '-')
    .replace(/-+/g, '-')
    .trim();

/**
 * Operating manuals (Załącznik nr 3) for the rented devices. The RODO clause is
 * no longer a separate file - its full wording lives in §8 of the signed contract.
 */
export async function collectRentalAttachments(productIds: string[]): Promise<Attachment[]> {
  const attachments: Attachment[] = [];
  const seen = new Set<string>();

  for (const productId of productIds) {
    const terms = getProductTerms(productId);
    if (!terms?.manualFile || seen.has(terms.manualFile)) continue;
    seen.add(terms.manualFile);

    const content = await readAsset(terms.manualFile);
    if (!content) {
      console.warn(`Brak pliku instrukcji: ${terms.manualFile}`);
      continue;
    }
    attachments.push({
      filename: `${asciiFileName(`Instrukcja obslugi - ${terms.deviceName}`)}.pdf`,
      content,
      contentType: 'application/pdf',
    });
  }

  return attachments;
}
