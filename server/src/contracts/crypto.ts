import crypto from 'node:crypto';
import { config } from '../config.js';

const key = crypto.createHash('sha256').update(config.contracts.encryptionKey).digest();

/** AES-256-GCM packed as v1:iv:tag:ciphertext (all base64url). */
export function encryptContractData(value: Buffer | string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const input = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join(':');
}

export function decryptContractData(packed: string): Buffer {
  const [version, ivB64, tagB64, dataB64] = packed.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Unsupported encrypted contract payload');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]);
}

export const sha256 = (value: Buffer | string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

export const randomSigningToken = (): string => crypto.randomBytes(32).toString('base64url');
export const signingTokenHash = (token: string): string => sha256(`contract:${token}`);