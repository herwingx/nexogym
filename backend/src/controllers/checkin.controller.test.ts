import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processCheckin } from './checkin.controller';
import { prisma } from '../db';
import { SubscriptionStatus } from '@prisma/client';

// Mock the prisma client
vi.mock('../db', () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    gym: {
      findUnique: vi.fn(),
    },
    visit: {
      create: vi.fn(),
    },
    $transaction: vi.fn((promises) => Promise.all(promises)),
  },
}));

// Mock services and utils
vi.mock('../services/n8n.service', () => ({
  sendRewardMessage: vi.fn().mockResolvedValue({}),
}));

describe('Checkin Controller - Gamification Engine', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Debe sumar +1 al streak si la última visita fue exactamente ayer', async () => {
    const gymId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '6f9619ff-8b86-4d01-b42d-00cf4fc964ff';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const mockReq = {
      gymId,
      body: { userId },
    } as any;

    // 1. Mock subscription found
    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'sub-1', status: SubscriptionStatus.ACTIVE });
    
    // 2. Mock user with last visit yesterday
    (prisma.user.findUnique as any).mockResolvedValue({
      id: userId,
      current_streak: 5,
      last_visit_at: yesterday,
      phone: '123456789',
    });

    // 3. Mock gym
    (prisma.gym.findUnique as any).mockResolvedValue({ id: gymId, rewards_config: {} });

    await processCheckin(mockReq, mockRes);

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: userId },
      data: expect.objectContaining({
        current_streak: 6, // 5 + 1
      }),
    }));
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      newStreak: 6,
    }));
  });

  it('Debe reiniciar el streak a 1 si la última visita fue hace más de 48 horas', async () => {
    const gymId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '6f9619ff-8b86-4d01-b42d-00cf4fc964ff';
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const mockReq = {
      gymId,
      body: { userId },
    } as any;

    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'sub-1', status: SubscriptionStatus.ACTIVE });
    (prisma.user.findUnique as any).mockResolvedValue({
      id: userId,
      current_streak: 10,
      last_visit_at: threeDaysAgo,
    });
    (prisma.gym.findUnique as any).mockResolvedValue({ id: gymId, rewards_config: {} });

    await processCheckin(mockReq, mockRes);

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        current_streak: 1, // Reset to 1
      }),
    }));
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      newStreak: 1,
    }));
  });

  it('Debe devolver error 403 si la suscripción está expirada', async () => {
    const mockReq = {
      gymId: '550e8400-e29b-41d4-a716-446655440000',
      body: { userId: '6f9619ff-8b86-4d01-b42d-00cf4fc964ff' },
    } as any;

    // Mock subscription NOT found (meaning expired or inactive based on controller logic)
    (prisma.subscription.findFirst as any).mockResolvedValue(null);

    await processCheckin(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('No active subscription found'),
    }));
  });
});
