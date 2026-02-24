import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import { env } from './config/env';
import { closeDatabaseConnections, prisma } from './db';
import { getMetricsSnapshot, metricsContentType, observeHttpMetrics } from './observability/metrics';

const port = env.PORT;

export const createApp = () => {
  const app = express();

  if (env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

const apiRateLimiter = createRateLimiter({
  keyPrefix: 'api',
  max: env.RATE_LIMIT_API_MAX,
  windowMs: env.RATE_LIMIT_API_WINDOW_MS,
});

const checkinRateLimiter = createRateLimiter({
  keyPrefix: 'checkin',
  max: env.RATE_LIMIT_CHECKIN_MAX,
  windowMs: env.RATE_LIMIT_CHECKIN_WINDOW_MS,
});

const biometricRateLimiter = createRateLimiter({
  keyPrefix: 'biometric',
  max: env.RATE_LIMIT_BIOMETRIC_MAX,
  windowMs: env.RATE_LIMIT_BIOMETRIC_WINDOW_MS,
});

  app.disable('x-powered-by');

  // Swagger Setup
  setupSwagger(app);

  // Security Middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    }),
  );

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

  app.use(observeHttpMetrics);

  // Body Parser
  app.use(express.json({ limit: env.BODY_LIMIT }));

  // Basic health-check route
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'GymSaaS Backend API' });
  });

  app.get('/health/ready', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'READY', service: 'GymSaaS Backend API' });
    } catch (error) {
      req.log?.error({ err: error }, 'Readiness probe failed');
      res.status(503).json({ status: 'NOT_READY', service: 'GymSaaS Backend API' });
    }
  });

  if (env.METRICS_ENABLED === 'true') {
    app.get('/metrics', async (req, res) => {
      if (env.METRICS_TOKEN) {
        const bearer = req.headers.authorization?.replace('Bearer ', '').trim();
        const token = bearer || String(req.headers['x-metrics-token'] || '').trim();

        if (!token || token !== env.METRICS_TOKEN) {
          res.status(401).json({ error: 'Unauthorized: invalid metrics token' });
          return;
        }
      }

      try {
        const snapshot = await getMetricsSnapshot();
        res.setHeader('Content-Type', metricsContentType);
        res.status(200).send(snapshot);
      } catch (error) {
        req.log?.error({ err: error }, 'Metrics snapshot failed');
        res.status(500).json({ error: 'Failed to collect metrics.' });
      }
    });
  }

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

  return app;
};

const app = createApp();

let server: ReturnType<typeof app.listen> | null = null;

if (env.NODE_ENV !== 'test') {
  server = app.listen(port, () => {
    logger.info({ port, docs: '/api-docs' }, 'Server started');
  });
}

const gracefulShutdown = (signal: string) => {
  logger.warn({ signal }, 'Shutdown signal received');

  if (!server) {
    process.exit(0);
  }

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error while closing HTTP server');
      process.exit(1);
    }

    try {
      await closeDatabaseConnections();
    } catch (shutdownError) {
      logger.error({ err: shutdownError }, 'Error while closing DB connections');
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
