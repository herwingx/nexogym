import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processCheckin } from './checkin.controller';
import { prisma } from '../db';
import { sendRewardMessage } from '../services/n8n.service';
import { AccessMethod, SubscriptionStatus } from '@prisma/client';

// Mock the prisma client
vi.mock('../db', () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
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
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const lastCheckinDate = new Date(yesterdayStr + 'T00:00:00.000Z');

    const mockReq = {
      gymId,
      body: { userId },
    } as any;

    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'sub-1', status: SubscriptionStatus.ACTIVE });

    (prisma.user.findUnique as any).mockResolvedValue({
      id: userId,
      name: 'Test',
      phone: '123456789',
      profile_picture_url: null,
      current_streak: 5,
      last_visit_at: yesterday,
      last_checkin_date: lastCheckinDate,
    });

    (prisma.gym.findUnique as any).mockResolvedValue({
      id: gymId,
      subscription_tier: 'PRO_QR',
      modules_config: { gamification: true, qr_access: true },
      rewards_config: {},
      last_reactivated_at: null,
    });

    await processCheckin(mockReq, mockRes);

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: userId },
      data: expect.objectContaining({
        current_streak: 6,
      }),
    }));
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      newStreak: 6,
      streak_updated: true,
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
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
    (prisma.user.findUnique as any).mockResolvedValue({
      id: userId,
      name: null,
      phone: null,
      profile_picture_url: null,
      current_streak: 10,
      last_visit_at: threeDaysAgo,
      last_checkin_date: new Date(threeDaysAgoStr + 'T00:00:00.000Z'),
    });
    (prisma.gym.findUnique as any).mockResolvedValue({
      id: gymId,
      subscription_tier: 'PRO_QR',
      modules_config: { gamification: true, qr_access: true },
      rewards_config: {},
      last_reactivated_at: null,
    });

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

  it('Debe registrar check-in QR y disparar webhook de recompensa con contexto de método de acceso', async () => {
    const gymId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '6f9619ff-8b86-4d01-b42d-00cf4fc964ff';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const lastCheckinDate = new Date(yesterdayStr + 'T00:00:00.000Z');

    const mockReq = {
      gymId,
      body: { userId, accessMethod: AccessMethod.QR },
    } as any;

    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'sub-1', status: SubscriptionStatus.ACTIVE });
    (prisma.user.findUnique as any).mockResolvedValue({
      id: userId,
      name: 'Usuario QR',
      profile_picture_url: 'https://cdn.test/qr.png',
      current_streak: 2,
      last_visit_at: yesterday,
      last_checkin_date: lastCheckinDate,
      phone: '+573001112233',
    });
    (prisma.gym.findUnique as any).mockResolvedValue({
      id: gymId,
      subscription_tier: 'PRO_QR',
      modules_config: { gamification: true, qr_access: true },
      rewards_config: { '3': 'Batido gratis' },
      last_reactivated_at: null,
    });

    await processCheckin(mockReq, mockRes);

    expect(prisma.visit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gym_id: gymId,
          user_id: userId,
          access_method: AccessMethod.QR,
        }),
      }),
    );

    expect(sendRewardMessage).toHaveBeenCalledWith(
      gymId,
      '+573001112233',
      'Batido gratis',
      3,
      AccessMethod.QR,
    );

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      rewardUnlocked: true,
      newStreak: 3,
      streak_updated: true,
    }));
  });

  it('Debe bloquear check-in QR cuando qr_access está deshabilitado por suscripción', async () => {
    const gymId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '6f9619ff-8b86-4d01-b42d-00cf4fc964ff';

    const mockReq = {
      gymId,
      body: { userId, accessMethod: AccessMethod.QR },
    } as any;

    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'sub-1', status: SubscriptionStatus.ACTIVE });
    (prisma.user.findUnique as any).mockResolvedValue({
      id: userId,
      name: null,
      profile_picture_url: null,
      current_streak: 1,
      last_visit_at: null,
      last_checkin_date: null,
      phone: '+573001112233',
    });
    (prisma.gym.findUnique as any).mockResolvedValue({
      id: gymId,
      subscription_tier: 'BASIC',
      modules_config: { qr_access: false, gamification: false },
      rewards_config: {},
      last_reactivated_at: null,
    });

    await processCheckin(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('qr_access') }),
    );
    expect(prisma.visit.create).not.toHaveBeenCalled();
  });

  it('Acepta code (QR GYM_QR_<qr_token>) y registra check-in igual que con userId', async () => {
    const gymId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '6f9619ff-8b86-4d01-b42d-00cf4fc964ff';
    const qrToken = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
    const code = `GYM_QR_${qrToken}`;

    const mockReq = {
      gymId,
      body: { code, accessMethod: AccessMethod.QR },
    } as any;

    (prisma.user.findFirst as any).mockResolvedValueOnce({ id: userId });
    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'sub-1', status: SubscriptionStatus.ACTIVE });
    (prisma.user.findUnique as any).mockResolvedValue({
      id: userId,
      name: null,
      profile_picture_url: null,
      current_streak: 2,
      last_visit_at: new Date(Date.now() - 86400000),
      last_checkin_date: new Date(new Date(Date.now() - 86400000).toISOString().split('T')[0] + 'T00:00:00.000Z'),
      phone: '+573001112233',
    });
    (prisma.gym.findUnique as any).mockResolvedValue({
      id: gymId,
      subscription_tier: 'PRO_QR',
      modules_config: { gamification: true, qr_access: true },
      rewards_config: {},
      last_reactivated_at: null,
    });

    await processCheckin(mockReq, mockRes);

    expect(prisma.visit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: userId,
          gym_id: gymId,
          access_method: AccessMethod.QR,
        }),
      }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });
});
