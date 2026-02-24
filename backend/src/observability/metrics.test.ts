import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import { getMetricsSnapshot, observeHttpMetrics } from './metrics';

describe('observability/metrics', () => {
  it('debe registrar métricas HTTP al finalizar una request', async () => {
    const req: any = {
      method: 'GET',
      path: '/health',
      baseUrl: '',
      route: { path: '/health' },
    };

    const res = new EventEmitter() as any;
    res.statusCode = 200;

    const next = vi.fn();
    observeHttpMetrics(req, res, next);

    expect(next).toHaveBeenCalled();

    res.emit('finish');

    const snapshot = await getMetricsSnapshot();
    expect(snapshot).toContain('gymsaas_http_requests_total');
    expect(snapshot).toContain('gymsaas_http_request_duration_ms');
  });
});
