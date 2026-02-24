import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLiveOccupancy, getDailyRevenue, getCommissions } from './analytics.controller';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    visit: {
      count: vi.fn(),
    },
    sale: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

describe('analytics.controller', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getLiveOccupancy debe marcar LLENO con más de 20 accesos activos', async () => {
    const req: any = {
      gymId: '550e8400-e29b-41d4-a716-446655440000',
    };

    (prisma.visit.count as any).mockResolvedValue(25);

    await getLiveOccupancy(req, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      activeUsers: 25,
      status: 'LLENO',
    });
  });
});

// ──────────────────────────────────────────────────────────────
describe('getDailyRevenue', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => vi.clearAllMocks());

  it('devuelve revenue del día especificado en ?date=', async () => {
    (prisma.sale.aggregate as any).mockResolvedValue({
      _sum: { total: 1500 },
      _count: { id: 8 },
    });
    const req: any = {
      gymId: 'gym-1',
      query: { date: '2026-02-24' },
    };
    await getDailyRevenue(req, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-02-24', revenue: 1500, sale_count: 8 }),
    );
  });

  it('usa la fecha de hoy si no se pasa ?date=', async () => {
    (prisma.sale.aggregate as any).mockResolvedValue({ _sum: { total: 0 }, _count: { id: 0 } });
    const req: any = { gymId: 'gym-1', query: {} };
    await getDailyRevenue(req, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    const jsonArg = (mockRes.json as any).mock.calls[0][0];
    expect(jsonArg.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('filtra ventas por gym_id del JWT', async () => {
    (prisma.sale.aggregate as any).mockResolvedValue({ _sum: { total: 200 }, _count: { id: 2 } });
    const req: any = { gymId: 'gym-2', query: { date: '2026-02-24' } };
    await getDailyRevenue(req, mockRes);
    expect(prisma.sale.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ gym_id: 'gym-2' }) }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
describe('getCommissions', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => vi.clearAllMocks());

  it('devuelve 401 si falta gymId', async () => {
    const req: any = { gymId: undefined, query: {} };
    await getCommissions(req, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('agrupa ventas por vendedor y las ordena de mayor a menor', async () => {
    (prisma.sale.groupBy as any).mockResolvedValue([
      { seller_id: 'u-1', _sum: { total: 5000 }, _count: { id: 20 } },
      { seller_id: 'u-2', _sum: { total: 2000 }, _count: { id: 8 } },
    ]);
    (prisma.user.findMany as any).mockResolvedValue([
      { id: 'u-1', name: 'Ana', role: 'STAFF' },
      { id: 'u-2', name: 'Luis', role: 'STAFF' },
    ]);

    const req: any = { gymId: 'gym-1', query: { month: '2026-02' } };
    await getCommissions(req, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    const result = (mockRes.json as any).mock.calls[0][0];
    expect(result.data[0].total_sales).toBeGreaterThanOrEqual(result.data[1].total_sales);
    expect(result.data[0].seller.name).toBe('Ana');
  });

  it('filtra ventas por gym_id del JWT', async () => {
    (prisma.sale.groupBy as any).mockResolvedValue([]);
    (prisma.user.findMany as any).mockResolvedValue([]);
    const req: any = { gymId: 'gym-3', query: {} };
    await getCommissions(req, mockRes);
    expect(prisma.sale.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ gym_id: 'gym-3' }) }),
    );
  });
});
