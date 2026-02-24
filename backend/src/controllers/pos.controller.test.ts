import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSale } from './pos.controller';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    cashShift: {
      findFirst: vi.fn(),
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
