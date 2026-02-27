import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';
import { NextFunction, Request, Response } from 'express';

const register = new Registry();

collectDefaultMetrics({ register, prefix: 'nexogym_' });

const httpRequestsTotal = new Counter({
  name: 'nexogym_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDurationMs = new Histogram({
  name: 'nexogym_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});

const resolveRouteLabel = (req: Request) => {
  if (req.route?.path) {
    return `${req.baseUrl || ''}${req.route.path}`;
  }

  if (req.baseUrl) {
    return req.baseUrl;
  }

  return req.path || 'unknown';
};

export const observeHttpMetrics = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const method = req.method;
    const route = resolveRouteLabel(req);
    const statusCode = String(res.statusCode);

    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationMs.observe({ method, route, status_code: statusCode }, durationMs);
  });

  next();
};

export const metricsContentType = register.contentType;

export const getMetricsSnapshot = async () => {
  return register.metrics();
};
