import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGym,
  deleteGym,
  exportGymData,
  getGlobalMetrics,
  getGymDetail,
  getGymModules,
  listGyms,
  updateGym,
  updateGymTier,
} from './saas.controller';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    gym: {
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    subscription: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: { findMany: vi.fn() },
    visit: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    sale: { findMany: vi.fn() },
    cashShift: { findMany: vi.fn() },
    gymClass: { findMany: vi.fn() },
    classBooking: { findMany: vi.fn() },
    routine: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
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

  describe('listGyms', () => {
    it('devuelve lista paginada de gyms con meta', async () => {
      const req = { query: {} } as any;
      (prisma.gym.findMany as any).mockResolvedValue([
        { id: 'g1', name: 'Gym A', _count: { users: 5, subscriptions: 3 } },
      ]);
      (prisma.gym.count as any).mockResolvedValue(1);

      await listGyms(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ total: 1, page: 1, limit: 20 }),
        }),
      );
    });
  });

  describe('getGymDetail', () => {
    it('devuelve 404 si el gym no existe', async () => {
      (prisma.gym.findUnique as any).mockResolvedValue(null);
      const req = { params: { id: 'no-existe' } } as any;

      await getGymDetail(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('devuelve detalle del gym con active_subscriptions', async () => {
      const req = { params: { id: 'gym-id' } } as any;
      (prisma.gym.findUnique as any).mockResolvedValue({
        id: 'gym-id',
        name: 'Gym Pro',
        subscription_tier: 'PRO_QR',
        _count: { users: 10, subscriptions: 8, visits: 200, sales: 50 },
      });
      (prisma.subscription.count as any).mockResolvedValue(6);

      await getGymDetail(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          gym: expect.objectContaining({ active_subscriptions: 6 }),
        }),
      );
    });
  });

  describe('updateGym', () => {
    it('devuelve 400 si no se envía ningún campo', async () => {
      const req = { params: { id: 'gym-id' }, body: {} } as any;

      await updateGym(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('actualiza nombre del gym correctamente', async () => {
      const req = { params: { id: 'gym-id' }, body: { name: 'Nuevo Nombre' } } as any;
      (prisma.gym.findUnique as any).mockResolvedValue({ id: 'gym-id' });
      (prisma.gym.update as any).mockResolvedValue({ id: 'gym-id', name: 'Nuevo Nombre' });

      await updateGym(req, mockRes);

      expect(prisma.gym.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'gym-id' }, data: { name: 'Nuevo Nombre' } }),
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteGym', () => {
    it('devuelve 400 si falta el header de confirmación', async () => {
      const req = { params: { id: 'gym-id' }, headers: {} } as any;

      await deleteGym(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('devuelve 404 si el gym no existe', async () => {
      const req = {
        params: { id: 'no-existe' },
        headers: { 'x-confirm-delete': 'CONFIRM_DELETE' },
      } as any;
      (prisma.gym.findUnique as any).mockResolvedValue(null);

      await deleteGym(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('elimina el gym con confirmación correcta', async () => {
      const req = {
        params: { id: 'gym-id' },
        headers: { 'x-confirm-delete': 'CONFIRM_DELETE' },
      } as any;
      (prisma.gym.findUnique as any).mockResolvedValue({ id: 'gym-id', name: 'Gym Test' });
      (prisma.gym.delete as any).mockResolvedValue({ id: 'gym-id' });

      await deleteGym(req, mockRes);

      expect(prisma.gym.delete).toHaveBeenCalledWith({ where: { id: 'gym-id' } });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('exportGymData', () => {
    it('devuelve 404 si el gym no existe', async () => {
      (prisma.gym.findUnique as any).mockResolvedValue(null);
      const req = { params: { id: 'no-existe' } } as any;

      await exportGymData(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('devuelve snapshot completo del tenant', async () => {
      const req = { params: { id: 'gym-id' } } as any;
      (prisma.gym.findUnique as any).mockResolvedValue({ id: 'gym-id', name: 'Gym Export' });
      (
        [
          prisma.user,
          prisma.subscription,
          prisma.visit,
          prisma.product,
          prisma.sale,
          prisma.cashShift,
          prisma.gymClass,
          prisma.classBooking,
          prisma.routine,
          prisma.auditLog,
        ] as any[]
      ).forEach((m) => (m.findMany as any).mockResolvedValue([]));

      await exportGymData(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          gym: expect.objectContaining({ id: 'gym-id' }),
          stats: expect.objectContaining({ total_users: 0 }),
        }),
      );
    });
  });
});
