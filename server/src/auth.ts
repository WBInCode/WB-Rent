import crypto from 'node:crypto';
import { config } from './config.js';

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8h

const b64url = (buf: Buffer) => buf.toString('base64url');

const hmac = (payload: string) =>
  crypto.createHmac('sha256', config.authSecret).update(payload).digest();

const timingSafeEqualStr = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self to keep timing constant, then fail
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Verify admin password.
 * Supports ADMIN_PASSWORD_HASH in format "scrypt:<saltHex>:<hashHex>"
 * (generate with: node -e "const c=require('crypto');const s=c.randomBytes(16);console.log('scrypt:'+s.toString('hex')+':'+c.scryptSync(process.argv[1],s,64).toString('hex'))" 'yourpassword')
 * Falls back to timing-safe comparison with plaintext ADMIN_PASSWORD.
 */
export const verifyPassword = (input: string): boolean => {
  if (typeof input !== 'string' || input.length === 0 || input.length > 256) {
    return false;
  }

  if (config.adminPasswordHash) {
    return verifyScryptHash(input, config.adminPasswordHash);
  }

  if (config.adminPassword) {
    return timingSafeEqualStr(input, config.adminPassword);
  }

  return false;
};

/** Verify input against a "scrypt:<saltHex>:<hashHex>" hash string. */
export const verifyScryptHash = (input: string, hashString: string): boolean => {
  if (typeof input !== 'string' || input.length === 0 || input.length > 256) return false;
  const parts = hashString.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, saltHex, hashHex] = parts;
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(input, Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
};

/** Create a "scrypt:<saltHex>:<hashHex>" hash for storage (e.g. in app_settings). */
export const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
};

/** Issue a signed, expiring admin token (HMAC-SHA256). */
export const issueToken = (): { token: string; expiresAt: number } => {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = b64url(Buffer.from(JSON.stringify({ exp: expiresAt })));
  const signature = b64url(hmac(payload));
  return { token: `${payload}.${signature}`, expiresAt };
};

/** Verify token signature and expiry. */
export const verifyToken = (token: string): boolean => {
  if (typeof token !== 'string' || token.length > 512) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;

  const expected = b64url(hmac(payload));
  if (!timingSafeEqualStr(signature, expected)) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && Date.now() < exp;
  } catch {
    return false;
  }
};

// === NEWSLETTER UNSUBSCRIBE TOKENS ===
// Stateless HMAC signature over the email - the unsubscribe link only works
// for the person who received the email (prevents unsubscribing others).

export const unsubscribeToken = (email: string): string =>
  b64url(hmac(`unsub:${email.toLowerCase()}`));

export const verifyUnsubscribeToken = (email: string, token: string): boolean => {
  if (typeof email !== 'string' || typeof token !== 'string' || token.length > 128) return false;
  return timingSafeEqualStr(token, unsubscribeToken(email));
};

// === CUSTOMER MAGIC-LINK TOKENS ("moje rezerwacje") ===
// Signed, expiring token carrying the customer email. Sent via email link;
// grants read access to that email's reservations only (per-resource auth).

const CUSTOMER_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export const issueCustomerToken = (email: string): { token: string; expiresAt: number } => {
  const expiresAt = Date.now() + CUSTOMER_TOKEN_TTL_MS;
  const payload = b64url(Buffer.from(JSON.stringify({ e: email.toLowerCase(), exp: expiresAt, t: 'customer' })));
  const signature = b64url(hmac(payload));
  return { token: `${payload}.${signature}`, expiresAt };
};

/** Returns the customer email when the token is valid, null otherwise. */
export const verifyCustomerToken = (token: string): string | null => {
  if (typeof token !== 'string' || token.length > 1024) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  const expected = b64url(hmac(payload));
  if (!timingSafeEqualStr(signature, expected)) return null;

  try {
    const { e, exp, t } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (t !== 'customer' || typeof e !== 'string') return null;
    if (typeof exp !== 'number' || Date.now() >= exp) return null;
    return e;
  } catch {
    return null;
  }
};
