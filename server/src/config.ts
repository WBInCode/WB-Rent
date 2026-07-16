import dotenv from 'dotenv';
import crypto from 'node:crypto';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// === Secrets validation ===
// In production there are NO defaults - missing secrets stop the server.
if (isProduction) {
  if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) {
    throw new Error('FATAL: ADMIN_PASSWORD or ADMIN_PASSWORD_HASH must be set in production');
  }
  if (!process.env.ADMIN_TOKEN) {
    throw new Error('FATAL: ADMIN_TOKEN (auth signing secret) must be set in production');
  }
  if (process.env.CONTRACTS_ENABLED !== 'false' && !process.env.CONTRACT_ENCRYPTION_KEY) {
    throw new Error('FATAL: CONTRACT_ENCRYPTION_KEY must be set when contracts are enabled in production');
  }
}

// Dev-only fallbacks (never used in production thanks to the guard above)
const devAuthSecret = crypto.randomBytes(32).toString('hex');
if (!isProduction && !process.env.ADMIN_TOKEN) {
  console.warn('⚠️  Dev mode: using a random auth secret (admin sessions reset on restart)');
}
if (!isProduction && !process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) {
  console.warn('⚠️  Dev mode: using default admin password "admin" (set ADMIN_PASSWORD in .env)');
}

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: !isProduction,

  // CORS - allow multiple origins
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim()),

  // SMTP
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '"WB-Rent" <noreply@wb-rent.pl>',
  },

  // Admin
  adminEmail: process.env.ADMIN_EMAIL || 'admin@wb-rent.pl',
  adminPassword: process.env.ADMIN_PASSWORD || (isProduction ? '' : 'admin'),
  // Optional scrypt hash ("scrypt:<saltHex>:<hashHex>") - takes precedence over plaintext
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
  // Secret used to sign admin session tokens (HMAC)
  authSecret: process.env.ADMIN_TOKEN || devAuthSecret,

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300', 10),
  },

  // Site URL (for emails)
  siteUrl: process.env.SITE_URL || 'http://localhost:3001',
  // Public API base URL (for links in emails, e.g. unsubscribe)
  apiUrl: process.env.API_URL || `http://localhost:${process.env.PORT || '3001'}`,

  // === PAYMENTS ===
  // Active gateway: 'payu' | 'przelewy24' | 'stripe' | 'none'
  payments: {
    provider: (process.env.PAYMENT_PROVIDER || 'none').toLowerCase().trim(),
    payu: {
      sandbox: process.env.PAYU_SANDBOX !== 'false',
      posId: process.env.PAYU_POS_ID || '',
      secondKey: process.env.PAYU_SECOND_KEY || '',
      clientId: process.env.PAYU_CLIENT_ID || '',
      clientSecret: process.env.PAYU_CLIENT_SECRET || '',
    },
    p24: {
      sandbox: process.env.P24_SANDBOX !== 'false',
      merchantId: process.env.P24_MERCHANT_ID || '',
      posId: process.env.P24_POS_ID || process.env.P24_MERCHANT_ID || '',
      crc: process.env.P24_CRC || '',
      apiKey: process.env.P24_API_KEY || '',
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
  },

  // === RENTAL CONTRACTS ===
  contracts: {
    enabled: process.env.CONTRACTS_ENABLED !== 'false',
    requireBeforePayment: process.env.CONTRACT_REQUIRED_BEFORE_PAYMENT !== 'false',
    // Production requires an explicit secret; dev derives a stable key from ADMIN_TOKEN.
    encryptionKey: process.env.CONTRACT_ENCRYPTION_KEY || `${process.env.ADMIN_TOKEN || devAuthSecret}:contracts`,
    storageDir: process.env.CONTRACT_STORAGE_DIR || 'storage/contracts',
    signingTtlHours: parseInt(process.env.CONTRACT_SIGNING_TTL_HOURS || '24', 10),
  },
};
