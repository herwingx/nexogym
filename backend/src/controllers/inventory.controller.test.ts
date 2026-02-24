import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProducts } from './inventory.controller';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('Inventory Controller - Multitenancy Strictness', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Debe devolver solo productos que pertenecen al gym_id del JWT (req.gymId)', async () => {
    const myGymId = 'gym-A';
    const otherGymId = 'gym-B';

    const mockReq = {
      gymId: myGymId, // Extraído del JWT por el middleware
    } as any;

    const productsInDb = [
      { id: 'p1', name: 'Agua', gym_id: myGymId },
      { id: 'p2', name: 'Barra Proteína', gym_id: myGymId },
    ];

    (prisma.product.findMany as any).mockResolvedValue(productsInDb);

    await getProducts(mockReq, mockRes);

    // Verificar que la consulta a Prisma usó el gym_id correcto
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        gym_id: myGymId,
      }),
    }));

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ data: productsInDb });
  });

  it('Debe devolver error 401 si no hay gym_id en el request context', async () => {
    const mockReq = {
      // gymId is missing
    } as any;

    await getProducts(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('Gym context missing'),
    }));
  });

  it('Debe ignorar un gym_id malicioso enviado en el body y usar el del JWT', async () => {
    const myGymId = 'gym-REAL';
    const maliciousGymId = 'gym-HACK';

    const mockReq = {
      gymId: myGymId,
      body: {
        name: 'Producto Fake',
        price: 10,
        gym_id: maliciousGymId, // Intento de inyección
      },
    } as any;

    (prisma.product.create as any).mockResolvedValue({ id: 'p-new', name: 'Producto Fake', gym_id: myGymId });

    const { createProduct } = await import('./inventory.controller');
    await createProduct(mockReq, mockRes);

    expect(prisma.product.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        gym_id: myGymId, // Debe usar el real
      }),
    }));
    // Verificamos que NO usó el malicioso
    expect(prisma.product.create).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        gym_id: maliciousGymId,
      }),
    }));
  });
});
