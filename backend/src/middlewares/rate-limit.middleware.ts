import { NextFunction, Request, Response } from 'express';

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitConfig = {
  max: number;
  windowMs: number;
  keyPrefix: string;
};

const buckets = new Map<string, Bucket>();

export const createRateLimiter = ({ max, windowMs, keyPrefix }: RateLimitConfig) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const requester = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${requester}`;

    const existing = buckets.get(key);

    if (!existing || now >= existing.resetAt) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      next();
      return;
    }

    existing.count += 1;
    buckets.set(key, existing);

    const remaining = Math.max(0, max - existing.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(existing.resetAt / 1000));

    if (existing.count > max) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }

    next();
  };
};
