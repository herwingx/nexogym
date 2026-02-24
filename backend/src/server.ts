import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';

// Import routers
import saasRouter from './routes/saas.routes';
import userRouter from './routes/user.routes';
import checkinRouter from './routes/checkin.routes';
import posRouter from './routes/pos.routes';
import inventoryRouter from './routes/inventory.routes';
import analyticsRouter from './routes/analytics.routes';
import biometricRouter from './routes/biometric.routes';
import bookingRouter from './routes/booking.routes';
import { setupSwagger } from './swagger';
import { logger } from './lib/logger';
import { createRateLimiter } from './middlewares/rate-limit.middleware';

dotenv.config({ quiet: true });

const app = express();
const port = process.env.PORT || 3000;

const apiRateLimiter = createRateLimiter({
  keyPrefix: 'api',
  max: 180,
  windowMs: 60 * 1000,
});

const checkinRateLimiter = createRateLimiter({
  keyPrefix: 'checkin',
  max: 60,
  windowMs: 60 * 1000,
});

const biometricRateLimiter = createRateLimiter({
  keyPrefix: 'biometric',
  max: 40,
  windowMs: 60 * 1000,
});

app.disable('x-powered-by');

// Swagger Setup
setupSwagger(app);

// Security Middlewares
app.use(helmet());
app.use(cors());

// Structured request logging
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const requestId = (req.headers['x-request-id'] as string) || randomUUID();
      res.setHeader('x-request-id', requestId);
      req.requestId = requestId;
      return requestId;
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  }),
);

// Body Parser
app.use(express.json());

// Basic health-check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'GymSaaS Backend API' });
});

app.use('/api/v1', apiRateLimiter);

// --- API Routes ---
app.use('/api/v1/saas', saasRouter);            // Sprint B3: SuperAdmin Panel
app.use('/api/v1/users', userRouter);            // Sprint B3: Member CRM (lifecycle completo)
app.use('/api/v1/checkin', checkinRateLimiter, checkinRouter);       // Sprint B4: Check-in & Gamification
app.use('/api/v1/pos', posRouter);               // Sprint B6/B7: POS, Expenses & Cash Shifts
app.use('/api/v1/inventory', inventoryRouter);   // Sprint B5: Control de Inventario
app.use('/api/v1/analytics', analyticsRouter);   // Sprint B8: Dashboard, Reportes y Auditoría
app.use('/api/v1/bookings', bookingRouter);      // Sprint B10: Clases y Reservas
app.use('/biometric', biometricRateLimiter, biometricRouter);          // Sprint B9: IoT / Hardware endpoint (no JWT, x-api-key)

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  req.log?.error(
    {
      requestId: req.requestId,
      path: req.path,
      method: req.method,
      statusCode: err.status || 500,
      err,
    },
    'Unhandled request error',
  );
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const server = app.listen(port, () => {
  logger.info({ port, docs: '/api-docs' }, 'Server started');
});

const gracefulShutdown = (signal: string) => {
  logger.warn({ signal }, 'Shutdown signal received');
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error while closing HTTP server');
      process.exit(1);
    }

    logger.info('HTTP server closed cleanly');
    process.exit(0);
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled Promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

export default app;
