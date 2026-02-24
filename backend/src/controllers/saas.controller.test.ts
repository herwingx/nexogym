import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGym, getGlobalMetrics, getGymModules, updateGymTier } from './saas.controller';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    gym: {
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
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

  it('createGym ignora modules_config manual y aplica defaults por tier', async () => {
    const req = {
      body: {
        name: 'Gym Pro',
        subscription_tier: 'PRO_QR',
        modules_config: {
          pos: false,
          qr_access: false,
          gamification: false,
          classes: false,
          biometrics: true,
        },
      },
    } as any;

    (prisma.gym.create as any).mockResolvedValue({ id: 'gym-id' });

    await createGym(req, mockRes);

    expect(prisma.gym.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscription_tier: 'PRO_QR',
          modules_config: {
            pos: true,
            qr_access: true,
            gamification: true,
            classes: true,
            biometrics: false,
          },
        }),
      }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(201);
  });

  it('updateGymTier sobrescribe modules_config según tier', async () => {
    const req = {
      params: { id: 'gym-id' },
      body: { subscription_tier: 'PREMIUM_BIO' },
    } as any;

    (prisma.gym.update as any).mockResolvedValue({ id: 'gym-id' });

    await updateGymTier(req, mockRes);

    expect(prisma.gym.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'gym-id' },
        data: expect.objectContaining({
          subscription_tier: 'PREMIUM_BIO',
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

  it('getGymModules devuelve módulos resueltos para un gym', async () => {
    const req = {
      params: { id: 'gym-id' },
    } as any;

    (prisma.gym.findUnique as any).mockResolvedValue({
      id: 'gym-id',
      name: 'Gym Pro',
      subscription_tier: 'PRO_QR',
      modules_config: { classes: false },
    });

    await getGymModules(req, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        gym_id: 'gym-id',
        subscription_tier: 'PRO_QR',
        modules_config: expect.objectContaining({
          pos: true,
          qr_access: true,
          gamification: true,
          classes: false,
          biometrics: false,
        }),
      }),
    );
  });
});
