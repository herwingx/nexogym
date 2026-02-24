import { describe, it, expect, vi, beforeEach } from 'vitest';
import { closeShift } from './shift.controller';
import { prisma } from '../db';
import { ShiftStatus } from '@prisma/client';

vi.mock('../db', () => ({
  prisma: {
    cashShift: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    sale: {
      aggregate: vi.fn(),
    },
    expense: {
      aggregate: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../utils/audit.logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/n8n.service', () => ({
  sendShiftSummary: vi.fn().mockResolvedValue({}),
}));

describe('Shift Controller - Financial Motor', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Debe calcular correctamente el expected_balance sumando ventas y restando gastos del turno actual', async () => {
    const gymId = 'gym-123';
    const userId = 'user-456';
    const openedAt = new Date('2026-02-23T08:00:00Z');

    const mockReq = {
      gymId,
      user: { id: userId },
      body: { actual_balance: 1500 },
    } as any;

    // 1. Mock open shift found
    (prisma.cashShift.findFirst as any).mockResolvedValue({
      id: 'shift-1',
      gym_id: gymId,
      user_id: userId,
      status: ShiftStatus.OPEN,
      opening_balance: 500,
      opened_at: openedAt,
    });

    // 2. Mock sales: $1200
    (prisma.sale.aggregate as any).mockResolvedValue({
      _sum: { total: 1200 },
    });

    // 3. Mock expenses: $200
    (prisma.expense.aggregate as any).mockResolvedValue({
      _sum: { amount: 200 },
    });

    // Expected balance = 500 (opening) + 1200 (sales) - 200 (expenses) = 1500
    const expectedBalance = 1500;

    await closeShift(mockReq, mockRes);

    expect(prisma.cashShift.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'shift-1' },
      data: expect.objectContaining({
        expected_balance: expectedBalance,
        actual_balance: 1500,
      }),
    }));

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      reconciliation: expect.objectContaining({
        expected: 1500,
        actual: 1500,
        difference: 0,
        status: 'BALANCED',
      }),
    }));
  });
});
