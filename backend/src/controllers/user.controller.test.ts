import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMyContext, updateUser, cancelSubscription, exportUserData, anonymizeUserData } from './user.controller';
import { prisma } from '../db';
import { logAuditEvent } from '../utils/audit.logger';

vi.mock('../db', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    visit: {
      findMany: vi.fn(),
    },
    classBooking: {
      findMany: vi.fn(),
    },
    gym: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../utils/audit.logger', () => ({
  logAuditEvent: vi.fn(),
}));

describe('user.controller', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getMyContext debe devolver usuario autenticado y módulos resueltos del gym', async () => {
    const req: any = {
      gymId: '550e8400-e29b-41d4-a716-446655440000',
      user: { id: '6f9619ff-8b86-4d01-b42d-00cf4fc964ff' },
    };

    (prisma.$transaction as any).mockResolvedValue([
      {
        id: req.user.id,
        role: 'ADMIN',
        name: 'Admin Gym',
      },
      {
        id: req.gymId,
        name: 'Gym Pro',
        subscription_tier: 'PRO_QR',
        modules_config: { classes: false },
      },
    ]);

    await getMyContext(req, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: req.user.id }),
        gym: expect.objectContaining({
          id: req.gymId,
          subscription_tier: 'PRO_QR',
          modules_config: expect.objectContaining({
            pos: true,
            qr_access: true,
            gamification: true,
            classes: false,
            biometrics: false,
          }),
        }),
      }),
    );
  });

  it('updateUser debe persistir profile_picture_url y auditar cambios', async () => {
    const req: any = {
      gymId: '550e8400-e29b-41d4-a716-446655440000',
      params: { id: '6f9619ff-8b86-4d01-b42d-00cf4fc964ff' },
      user: { id: '6f9619ff-8b86-4d01-b42d-00cf4fc964ff' },
      body: {
        name: 'Nuevo Nombre',
        profile_picture_url: 'https://cdn.example.com/avatar.jpg',
      },
    };

    (prisma.user.findFirst as any).mockResolvedValue({ id: req.params.id, gym_id: req.gymId, deleted_at: null });
    (prisma.user.update as any).mockResolvedValue({ id: req.params.id, profile_picture_url: req.body.profile_picture_url });

    await updateUser(req, mockRes);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Nuevo Nombre',
          profile_picture_url: 'https://cdn.example.com/avatar.jpg',
        }),
      }),
    );
    expect(logAuditEvent).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('cancelSubscription debe cancelar suscripción activa y auditar', async () => {
    const req: any = {
      gymId: '550e8400-e29b-41d4-a716-446655440000',
      params: { id: '6f9619ff-8b86-4d01-b42d-00cf4fc964ff' },
      user: { id: 'admin-id' },
      body: { reason: 'Solicitud del cliente' },
    };

    (prisma.subscription.findFirst as any).mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
    });
    (prisma.subscription.update as any).mockResolvedValue({
      id: 'sub-1',
      status: 'CANCELED',
    });

    await cancelSubscription(req, mockRes);

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: expect.objectContaining({ status: 'CANCELED' }),
      }),
    );
    expect(logAuditEvent).toHaveBeenCalledWith(
      req.gymId,
      'admin-id',
      'SUBSCRIPTION_CANCELED',
      expect.objectContaining({ target_user_id: req.params.id }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('exportUserData debe devolver snapshot de datos del usuario y auditar', async () => {
    const req: any = {
      gymId: '550e8400-e29b-41d4-a716-446655440000',
      params: { id: '6f9619ff-8b86-4d01-b42d-00cf4fc964ff' },
      user: { id: 'admin-id' },
    };

    (prisma.user.findFirst as any).mockResolvedValue({
      id: req.params.id,
      gym_id: req.gymId,
      phone: '+573001112233',
      name: 'Usuario Export',
    });
    (prisma.$transaction as any).mockResolvedValue([[{ id: 'sub-1' }], [{ id: 'visit-1' }], [{ id: 'booking-1' }]]);

    await exportUserData(req, mockRes);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(logAuditEvent).toHaveBeenCalledWith(
      req.gymId,
      'admin-id',
      'USER_DATA_EXPORTED',
      expect.objectContaining({ target_user_id: req.params.id }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: req.params.id }),
        subscriptions: expect.any(Array),
        visits: expect.any(Array),
        bookings: expect.any(Array),
      }),
    );
  });

  it('anonymizeUserData debe anonimizar PII y cancelar suscripciones activas', async () => {
    const req: any = {
      gymId: '550e8400-e29b-41d4-a716-446655440000',
      params: { id: '6f9619ff-8b86-4d01-b42d-00cf4fc964ff' },
      user: { id: 'admin-id' },
    };

    (prisma.user.findFirst as any).mockResolvedValue({ id: req.params.id, deleted_at: null });
    (prisma.$transaction as any).mockResolvedValue([{}, {}]);

    await anonymizeUserData(req, mockRes);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(logAuditEvent).toHaveBeenCalledWith(
      req.gymId,
      'admin-id',
      'USER_DATA_ANONYMIZED',
      expect.objectContaining({ target_user_id: req.params.id }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });
});
