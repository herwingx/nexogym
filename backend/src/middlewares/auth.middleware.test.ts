import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireAuth } from './auth.middleware';
import { supabase } from '../lib/supabase';
import { prisma } from '../db';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    gym: { findUnique: vi.fn() },
  },
}));

describe('auth.middleware', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe adjuntar contexto de usuario interno cuando token es válido', async () => {
    const req: any = {
      headers: { authorization: 'Bearer token-123' },
    };

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'auth-user-id', email: 'admin@gym.com' } },
      error: null,
    });

    (prisma.user.findFirst as any).mockResolvedValue({
      id: '6f9619ff-8b86-4d01-b42d-00cf4fc964ff',
      gym_id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'ADMIN',
    });
    (prisma.gym.findUnique as any).mockResolvedValue({
      status: 'ACTIVE',
      deleted_at: null,
    });

    await requireAuth(req, mockRes, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe('6f9619ff-8b86-4d01-b42d-00cf4fc964ff');
    expect(req.authUserId).toBe('auth-user-id');
    expect(req.gymId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(req.userRole).toBe('ADMIN');
  });

  it('debe responder 401 cuando token es inválido', async () => {
    const req: any = {
      headers: { authorization: 'Bearer bad-token' },
    };

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' },
    });

    await requireAuth(req, mockRes, next);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
