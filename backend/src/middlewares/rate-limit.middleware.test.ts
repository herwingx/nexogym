import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from './rate-limit.middleware';

describe('rate-limit.middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe permitir requests dentro del límite y bloquear cuando excede', () => {
    const middleware = createRateLimiter({
      keyPrefix: 'test',
      max: 2,
      windowMs: 60_000,
    });

    const baseReq = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any;

    const mockRes = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const next = vi.fn();

    middleware(baseReq, mockRes, next);
    middleware(baseReq, mockRes, next);
    middleware(baseReq, mockRes, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Too many requests. Please try again later.' });
  });
});
