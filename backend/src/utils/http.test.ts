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
    const payload = res.json.mock.calls[0][0];
    expect(payload).toMatchObject({ error: 'Something failed' });
    expect(typeof payload.error).toBe('string');
    // En desarrollo se incluye detail con el mensaje del error
    if (process.env.NODE_ENV !== 'production') {
      expect(payload.detail).toBe('boom');
    }
  });
});
