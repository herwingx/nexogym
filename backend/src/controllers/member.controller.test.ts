import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMemberProfile, getMemberHistory } from './member.controller';
import { prisma } from '../db';
import { SubscriptionStatus } from '@prisma/client';

vi.mock('../db', () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    subscription: { findFirst: vi.fn() },
    visit: { count: vi.fn(), findMany: vi.fn() },
    gym: { findUnique: vi.fn() },
  },
}));

describe('member.controller', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  const gymId = '550e8400-e29b-41d4-a716-446655440000';
  const userId = '6f9619ff-8b86-4d01-b42d-00cf4fc964ff';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMemberProfile', () => {
    it('debe devolver 401 si no hay userId', async () => {
      const req: any = { gymId, user: { id: undefined } };
      await getMemberProfile(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('debe devolver 401 si no hay gymId', async () => {
      const req: any = { gymId: undefined, user: { id: userId } };
      await getMemberProfile(req, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('debe devolver 404 si el socio no existe o no pertenece al gym (tenant isolation)', async () => {
      (prisma.user.findFirst as any).mockResolvedValue(null);
      const req: any = { gymId, user: { id: userId } };
      await getMemberProfile(req, mockRes);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: userId, gym_id: gymId, deleted_at: null },
        select: expect.any(Object),
      });
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Member not found' });
    });

    it('debe devolver 200 con perfil, membership_status ACTIVE y next_reward cuando hay rewards_config', async () => {
      (prisma.user.findFirst as any).mockResolvedValue({
        id: userId,
        name: 'Juan',
        profile_picture_url: null,
        current_streak: 2,
      });
      (prisma.subscription.findFirst as any).mockResolvedValue({
        id: 'sub-1',
        status: SubscriptionStatus.ACTIVE,
        expires_at: new Date('2026-12-31'),
      });
      (prisma.visit.count as any).mockResolvedValue(10);
      (prisma.gym.findUnique as any).mockResolvedValue({
        id: gymId,
        rewards_config: { streak_bonus: { streak_3: 1, streak_5: 2 } },
      });
      const req: any = { gymId, user: { id: userId, email: 'juan@test.com' } };
      await getMemberProfile(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: userId,
          name: 'Juan',
          membership_status: 'ACTIVE',
          current_streak: 2,
          total_visits: 10,
          next_reward: { label: 'Racha 3 visitas', visits_required: 3, visits_progress: 2 },
        }),
      );
    });

    it('debe devolver membership_status EXPIRED cuando no hay suscripción activa', async () => {
      (prisma.user.findFirst as any).mockResolvedValue({
        id: userId,
        name: 'Maria',
        profile_picture_url: null,
        current_streak: 0,
      });
      (prisma.subscription.findFirst as any).mockResolvedValue(null);
      (prisma.visit.count as any).mockResolvedValue(0);
      (prisma.gym.findUnique as any).mockResolvedValue({ id: gymId, rewards_config: null });
      const req: any = { gymId, user: { id: userId } };
      await getMemberProfile(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          membership_status: 'EXPIRED',
          next_reward: null,
        }),
      );
    });
  });

  describe('getMemberHistory', () => {
    it('debe devolver 401 si no hay userId o gymId', async () => {
      await getMemberHistory({ gymId, user: { id: undefined } } as any, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      vi.clearAllMocks();
      await getMemberHistory({ gymId: undefined, user: { id: userId } } as any, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('debe devolver 200 con historial paginado filtrado por user_id y gym_id (tenant isolation)', async () => {
      const visits = [
        {
          id: 'v1',
          check_in_time: new Date('2026-02-20T10:00:00Z'),
          access_method: 'QR',
        },
      ];
      (prisma.visit.findMany as any).mockResolvedValue(visits);
      (prisma.visit.count as any).mockResolvedValue(1);
      const req: any = { gymId, user: { id: userId }, query: { page: '2', pageSize: '10' } };
      await getMemberHistory(req, mockRes);

      expect(prisma.visit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: userId, gym_id: gymId },
          orderBy: { check_in_time: 'desc' },
          skip: 10,
          take: 10,
        }),
      );
      expect(prisma.visit.count).toHaveBeenCalledWith({ where: { user_id: userId, gym_id: gymId } });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Array),
          total: 1,
          page: 2,
          pageSize: 10,
        }),
      );
    });

    it('debe limitar pageSize a 100 y page mínimo 1', async () => {
      (prisma.visit.findMany as any).mockResolvedValue([]);
      (prisma.visit.count as any).mockResolvedValue(0);
      const req: any = { gymId, user: { id: userId }, query: { page: '0', pageSize: '500' } };
      await getMemberHistory(req, mockRes);

      expect(prisma.visit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 100,
        }),
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 100 }),
      );
    });
  });
});
