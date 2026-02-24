import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireModuleEnabled } from './module-access.middleware';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    gym: {
      findUnique: vi.fn(),
    },
  },
}));

describe('module-access.middleware', () => {
  const next = vi.fn();
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite acceso cuando el módulo está habilitado', async () => {
    const req: any = { gymId: '550e8400-e29b-41d4-a716-446655440000' };
    (prisma.gym.findUnique as any).mockResolvedValue({
      subscription_tier: 'PRO_QR',
      modules_config: { classes: true },
    });

    await requireModuleEnabled('classes')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('bloquea acceso cuando el módulo está deshabilitado', async () => {
    const req: any = { gymId: '550e8400-e29b-41d4-a716-446655440000' };
    (prisma.gym.findUnique as any).mockResolvedValue({
      subscription_tier: 'BASIC',
      modules_config: { classes: false },
    });

    await requireModuleEnabled('classes')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('classes') }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna formato hardware cuando biometrics está deshabilitado', async () => {
    const req: any = { gymId: '550e8400-e29b-41d4-a716-446655440000' };
    (prisma.gym.findUnique as any).mockResolvedValue({
      subscription_tier: 'PRO_QR',
      modules_config: { biometrics: false },
    });

    await requireModuleEnabled('biometrics', { hardwareResponse: true })(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        openDoor: false,
        error: expect.stringContaining('biometrics'),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});