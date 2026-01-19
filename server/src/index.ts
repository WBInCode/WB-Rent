import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { initializeDatabase } from './db.js';
import routes from './routes.js';

const app = express();

// === MIDDLEWARE ===

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
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

  app.listen(config.port, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║           WB-RENT API SERVER              ║
╠═══════════════════════════════════════════╣
║  🚀 Server running on port ${config.port}           ║
║  📍 http://localhost:${config.port}                 ║
║  🌐 CORS origin: ${config.corsOrigin}    ║
║  🔧 Environment: ${config.nodeEnv}           ║
╚═══════════════════════════════════════════╝
    `);
  });
};

startServer();
