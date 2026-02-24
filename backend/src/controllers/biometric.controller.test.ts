import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessMethod, SubscriptionStatus } from '@prisma/client';
import { biometricCheckIn } from './biometric.controller';
import { prisma } from '../db';
import { sendRewardMessage } from '../services/n8n.service';

vi.mock('../db', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
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

vi.mock('../services/n8n.service', () => ({
  sendRewardMessage: vi.fn().mockResolvedValue({}),
}));

describe('Biometric Controller - Smoke', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bloquea ingreso por anti-passback (<4h)', async () => {
    const gymId = '550e8400-e29b-41d4-a716-446655440000';
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const mockReq = {
      gymId,
      body: { footprint_id: 'fp-001' },
    } as any;

    (prisma.user.findFirst as any).mockResolvedValue({
      id: '6f9619ff-8b86-4d01-b42d-00cf4fc964ff',
      last_visit_at: twoHoursAgo,
      current_streak: 5,
    });
    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'sub-1', status: SubscriptionStatus.ACTIVE });

    await biometricCheckIn(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        openDoor: false,
        reason: expect.stringContaining('Anti-Passback'),
      }),
    );
    expect(prisma.visit.create).not.toHaveBeenCalled();
  });

  it('registra ingreso biométrico y dispara reward webhook con BIOMETRIC', async () => {
    const gymId = '550e8400-e29b-41d4-a716-446655440000';
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const userId = '6f9619ff-8b86-4d01-b42d-00cf4fc964ff';

    const mockReq = {
      gymId,
      body: { footprint_id: 'fp-001' },
      log: {
        error: vi.fn(),
      },
    } as any;

    (prisma.user.findFirst as any).mockResolvedValue({
      id: userId,
      gym_id: gymId,
      pin_hash: 'fp-001',
      current_streak: 2,
      last_visit_at: yesterday,
      phone: '+573001112233',
    });
    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'sub-1', status: SubscriptionStatus.ACTIVE });
    (prisma.gym.findUnique as any).mockResolvedValue({
      id: gymId,
      rewards_config: { '3': 'Toalla gratis' },
    });

    await biometricCheckIn(mockReq, mockRes);

    expect(prisma.visit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gym_id: gymId,
          user_id: userId,
          access_method: AccessMethod.BIOMETRIC,
        }),
      }),
    );

    expect(sendRewardMessage).toHaveBeenCalledWith(
      gymId,
      '+573001112233',
      'Toalla gratis',
      3,
      AccessMethod.BIOMETRIC,
    );

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        openDoor: true,
        rewardUnlocked: true,
        newStreak: 3,
      }),
    );
  });
});