import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { initializeDatabase } from './db.js';
import routes from './routes.js';
import adminRoutes from './admin.js';
import paymentRoutes from './payments/routes.js';
import { getActiveProvider } from './payments/index.js';
import contractRoutes from './contracts/routes.js';
import { initScheduler } from './scheduler.js';

const app = express();

// === MIDDLEWARE ===

// Trust proxy for Railway/Vercel (required for rate limiting)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS - strict allowlist (dev + production origins)
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://wb-rent.vercel.app',
  'https://wb-rent.pl',
  'https://www.wb-rent.pl',
  ...config.corsOrigins,
]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS: blocked origin ${origin}`);
      callback(null, false); // Reject - no CORS headers, browser blocks the response
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsers (rawBody kept for payment webhook signature verification).
// Only contract signatures may carry a larger handwritten PNG payload.
const captureRawBody = (req: express.Request, _res: express.Response, buf: Buffer) => {
  (req as any).rawBody = buf;
};
app.use('/api/contracts', express.json({ limit: '512kb', verify: captureRawBody }));
app.use(express.json({ limit: '10kb', verify: captureRawBody }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Zbyt wiele żądań. Spróbuj ponownie za kilka minut.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// === ROUTES ===
app.use('/api', routes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/contracts', contractRoutes);

// === 404 HANDLER ===
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint nie istnieje',
  });
});

// === ERROR HANDLER ===
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Wystąpił nieoczekiwany błąd serwera',
  });
});

// === START SERVER ===
const startServer = async () => {
  // Initialize database
  await initializeDatabase();
  
  // Initialize scheduler for automatic reminders
  initScheduler();

  app.listen(config.port, () => {
    const paymentProvider = getActiveProvider();
    console.log(`
╔══════════════════════════════════════════╗
║           WB-RENT API SERVER              ║
╠══════════════════════════════════════════╣
║  🚀 Server running on port ${config.port}           ║
║  📍 http://localhost:${config.port}                 ║
║  🌐 CORS origins: ${config.corsOrigins.join(', ')}    ║
║  🔧 Environment: ${config.nodeEnv}           ║
║  💳 Payments: ${paymentProvider ? paymentProvider.name + (config.payments.provider === 'payu' && config.payments.payu.sandbox ? ' (SANDBOX)' : '') : 'disabled'}          ║
║  ⏰ Reminders: daily at 9:00 AM          ║
╚═══════════════════════════════════════════╝
    `);
  });
};

startServer();
