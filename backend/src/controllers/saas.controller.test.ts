import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGym, getGlobalMetrics, updateGymTier } from './saas.controller';
import { prisma } from '../db';
import { SubscriptionTier } from '@prisma/client';

vi.mock('../db', () => ({
  prisma: {
    gym: {
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('saas.controller', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createGym aplica modules_config por tier cuando no se envía custom config', async () => {
    const req = {
      body: {
        name: 'Gym Pro',
        subscription_tier: SubscriptionTier.PRO_QR,
      },
    } as any;

    (prisma.gym.create as any).mockResolvedValue({ id: 'gym-id' });

    await createGym(req, mockRes);

    expect(prisma.gym.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscription_tier: SubscriptionTier.PRO_QR,
          modules_config: {
            pos: true,
            qr_access: true,
            gamification: true,
            classes: true,
          },
        }),
      }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(201);
  });

  it('updateGymTier sobrescribe modules_config según tier', async () => {
    const req = {
      params: { id: 'gym-id' },
      body: { subscription_tier: SubscriptionTier.PREMIUM_BIO },
    } as any;

    (prisma.gym.update as any).mockResolvedValue({ id: 'gym-id' });

    await updateGymTier(req, mockRes);

    expect(prisma.gym.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'gym-id' },
        data: expect.objectContaining({
          subscription_tier: SubscriptionTier.PREMIUM_BIO,
          modules_config: {
            pos: true,
            qr_access: true,
            gamification: true,
            classes: true,
            biometrics: true,
          },
        }),
      }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('getGlobalMetrics responde total_active_gyms', async () => {
    (prisma.gym.count as any).mockResolvedValue(12);

    await getGlobalMetrics({} as any, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ total_active_gyms: 12 });
  });
});
