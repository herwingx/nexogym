import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRewardsConfig, updateRewardsConfig } from './gym.controller';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    gym: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('gym.controller', () => {
  const gymId = 'gym-123';
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRewardsConfig', () => {
    it('returns streak_rewards from gym config', async () => {
      (prisma.gym.findUnique as any).mockResolvedValue({
        rewards_config: {
          streak_rewards: [
            { days: 7, label: 'Batido gratis' },
            { days: 30, label: 'Mes gratis' },
          ],
        },
      });
      const req = { gymId } as any;
      await getRewardsConfig(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        streak_rewards: [
          { days: 7, label: 'Batido gratis' },
          { days: 30, label: 'Mes gratis' },
        ],
      });
    });

    it('returns empty array when no rewards_config', async () => {
      (prisma.gym.findUnique as any).mockResolvedValue({ rewards_config: null });
      const req = { gymId } as any;
      await getRewardsConfig(req, mockRes);
      expect(mockRes.json).toHaveBeenCalledWith({ streak_rewards: [] });
    });

    it('returns 401 when gymId missing', async () => {
      const req = { gymId: undefined } as any;
      await getRewardsConfig(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('returns 404 when gym not found', async () => {
      (prisma.gym.findUnique as any).mockResolvedValue(null);
      const req = { gymId } as any;
      await getRewardsConfig(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateRewardsConfig', () => {
    it('updates gym rewards_config with streak_rewards', async () => {
      (prisma.gym.findUnique as any).mockResolvedValue({
        id: gymId,
        rewards_config: null,
      });
      (prisma.gym.update as any).mockResolvedValue({
        id: gymId,
        rewards_config: {
          streak_rewards: [
            { days: 7, label: 'Batido' },
            { days: 30, label: 'Mes gratis' },
          ],
        },
      });
      const req = {
        gymId,
        body: {
          streak_rewards: [
            { days: 7, label: 'Batido' },
            { days: 30, label: 'Mes gratis' },
          ],
        },
      } as any;
      await updateRewardsConfig(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(prisma.gym.update).toHaveBeenCalledWith({
        where: { id: gymId },
        data: {
          rewards_config: expect.objectContaining({
            streak_rewards: [
              { days: 7, label: 'Batido' },
              { days: 30, label: 'Mes gratis' },
            ],
          }),
        },
      });
    });

    it('returns 400 for invalid body (duplicate days)', async () => {
      const req = {
        gymId,
        body: {
          streak_rewards: [
            { days: 7, label: 'A' },
            { days: 7, label: 'B' },
          ],
        },
      } as any;
      await updateRewardsConfig(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
      );
    });
  });
});
