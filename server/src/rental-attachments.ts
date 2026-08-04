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

/**
 * Operating manuals (Załącznik nr 3) plus the shared RODO clause, so the
 * customer receives the same document pack that used to be handed over on paper.
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
      filename: `Instrukcja obslugi - ${terms.deviceName}.pdf`.replace(/[^\w .,-]/g, ''),
      content,
      contentType: 'application/pdf',
    });
  }

  const rodo = await readAsset('klauzula-rodo.pdf');
  if (rodo) {
    attachments.push({
      filename: 'Klauzula informacyjna RODO.pdf',
      content: rodo,
      contentType: 'application/pdf',
    });
  }

  return attachments;
}
