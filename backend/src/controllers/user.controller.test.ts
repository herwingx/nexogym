import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateUser } from './user.controller';
import { prisma } from '../db';
import { logAuditEvent } from '../utils/audit.logger';

vi.mock('../db', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
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
});
