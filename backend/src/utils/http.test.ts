import { describe, expect, it, vi } from 'vitest';
import { handleControllerError } from './http';

describe('utils/http.handleControllerError', () => {
  it('debe loggear y responder con payload estandarizado de error', () => {
    const req = {
      requestId: 'req-1',
      path: '/api/v1/test',
      method: 'GET',
      log: {
        error: vi.fn(),
      },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    handleControllerError(req, res, new Error('boom'), '[UnitTest Error]', 'Something failed', 500);

    expect(req.log.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Something failed' });
  });
});
