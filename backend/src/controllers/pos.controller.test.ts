import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSale, getCurrentShift, getSales } from './pos.controller';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    cashShift: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    sale: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    expense: {
      aggregate: vi.fn(),
    },
  },
}));

describe('pos.controller', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createSale debe responder 400 si no hay turno abierto', async () => {
    const req: any = {
      gymId: '550e8400-e29b-41d4-a716-446655440000',
      user: { id: '6f9619ff-8b86-4d01-b42d-00cf4fc964ff' },
      body: {
        items: [{ productId: '123e4567-e89b-42d3-a456-426614174000', quantity: 1 }],
      },
    };

    (prisma.cashShift.findFirst as any).mockResolvedValue(null);

    await createSale(req, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('No open shift found') }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
describe('getCurrentShift', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => vi.clearAllMocks());

  it('devuelve 404 si no hay turno abierto para el usuario', async () => {
    (prisma.cashShift.findFirst as any).mockResolvedValue(null);
    const req: any = { gymId: 'gym-1', user: { id: 'user-1' } };
    await getCurrentShift(req, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it('calcula correctamente expected_balance con ventas y egresos del turno', async () => {
    const shift = { id: 'shift-1', opening_balance: 500 };
    (prisma.cashShift.findFirst as any).mockResolvedValue(shift);
    (prisma.sale.aggregate as any).mockResolvedValue({ _sum: { total: 300 } });
    (prisma.expense.aggregate as any).mockResolvedValue({ _sum: { amount: 80 } });
    (prisma.sale.count as any).mockResolvedValue(5);

    const req: any = { gymId: 'gym-1', user: { id: 'user-1' } };
    await getCurrentShift(req, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        running_totals: expect.objectContaining({
          total_sales: 300,
          total_expenses: 80,
          expected_balance: 720, // 500 + 300 - 80
          sale_count: 5,
        }),
      }),
    );
  });

  it('filtra ventas y egresos por cash_shift_id, no por rango de fechas', async () => {
    const shift = { id: 'shift-turno-especifico', opening_balance: 100 };
    (prisma.cashShift.findFirst as any).mockResolvedValue(shift);
    (prisma.sale.aggregate as any).mockResolvedValue({ _sum: { total: 0 } });
    (prisma.expense.aggregate as any).mockResolvedValue({ _sum: { amount: 0 } });
    (prisma.sale.count as any).mockResolvedValue(0);

    const req: any = { gymId: 'gym-1', user: { id: 'user-1' } };
    await getCurrentShift(req, mockRes);

    expect(prisma.sale.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cash_shift_id: 'shift-turno-especifico' }),
      }),
    );
    // No debe filtrar por created_at
    expect(prisma.sale.aggregate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ created_at: expect.anything() }),
      }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
describe('getSales', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => vi.clearAllMocks());

  it('devuelve 401 si falta gymId', async () => {
    const req: any = { gymId: undefined, query: {} };
    await getSales(req, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('filtra ventas por gym_id y devuelve paginación', async () => {
    const gymId = 'gym-1';
    const fakeSales = [{ id: 'sale-1', total: 100 }];
    (prisma.sale.findMany as any).mockResolvedValue(fakeSales);
    (prisma.sale.count as any).mockResolvedValue(1);

    const req: any = { gymId, query: {} };
    await getSales(req, mockRes);

    expect(prisma.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ gym_id: gymId }) }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: fakeSales }),
    );
  });
});
