import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBooking } from './booking.controller';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
    },
    gymClass: {
      findFirst: vi.fn(),
    },
    classBooking: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('booking.controller', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createBooking consulta clase dentro del gym actual (aislamiento tenant)', async () => {
    const gymId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '6f9619ff-8b86-4d01-b42d-00cf4fc964ff';
    const classId = '123e4567-e89b-42d3-a456-426614174000';

    const req = {
      gymId,
      user: { id: userId },
      body: { classId, date: '2026-02-23' },
    } as any;

    (prisma.subscription.findFirst as any).mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
    });
    (prisma.gymClass.findFirst as any).mockResolvedValue({ id: classId, capacity: 10 });
    (prisma.classBooking.count as any).mockResolvedValue(0);
    (prisma.classBooking.findFirst as any).mockResolvedValue(null);
    (prisma.classBooking.create as any).mockResolvedValue({ id: 'booking-1' });

    await createBooking(req, mockRes);

    expect(prisma.gymClass.findFirst).toHaveBeenCalledWith({
      where: { id: classId, gym_id: gymId },
    });
    expect(prisma.classBooking.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ gym_id: gymId, class_id: classId }),
      }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(201);
  });
});
