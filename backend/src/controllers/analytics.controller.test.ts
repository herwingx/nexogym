import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLiveOccupancy } from './analytics.controller';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    visit: {
      count: vi.fn(),
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
