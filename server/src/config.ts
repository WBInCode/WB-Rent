import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

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
  adminPassword: process.env.ADMIN_PASSWORD || 'wbrent2026',
  adminToken: process.env.ADMIN_TOKEN || 'wb-rent-admin-secret-token-2026',

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
  },

  // Site URL (for emails)
  siteUrl: process.env.SITE_URL || 'http://localhost:3001',
};
