import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { initializeDatabase } from './db.js';
import routes from './routes.js';
import adminRoutes from './admin.js';
import { initScheduler } from './scheduler.js';

const app = express();

// === MIDDLEWARE ===

// Security headers
app.use(helmet());

// CORS - allow multiple origins for dev
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      config.corsOrigin,
    ];
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in dev
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parser
app.use(express.json({ limit: '10kb' }));

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
const startServer = () => {
  // Initialize database
  initializeDatabase();
  
  // Initialize scheduler for automatic reminders
  initScheduler();

  app.listen(config.port, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║           WB-RENT API SERVER              ║
╠═══════════════════════════════════════════╣
║  🚀 Server running on port ${config.port}           ║
║  📍 http://localhost:${config.port}                 ║
║  🌐 CORS origin: ${config.corsOrigin}    ║
║  🔧 Environment: ${config.nodeEnv}           ║
║  ⏰ Reminders: daily at 9:00 AM          ║
╚═══════════════════════════════════════════╝
    `);
  });
};

startServer();
