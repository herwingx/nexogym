import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBooking, cancelBooking, markAttendance } from './booking.controller';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
    },
    gymClass: {
      findFirst: vi.fn(),
    },
    classBooking: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('booking.controller', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createBooking consulta clase dentro del gym actual (aislamiento tenant)', async () => {
    const gymId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '6f9619ff-8b86-4d01-b42d-00cf4fc964ff';
    const classId = '123e4567-e89b-42d3-a456-426614174000';

    const req = {
      gymId,
      user: { id: userId },
      body: { classId, date: '2026-02-23' },
    } as any;

    (prisma.subscription.findFirst as any).mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
    });
    (prisma.gymClass.findFirst as any).mockResolvedValue({ id: classId, capacity: 10 });
    (prisma.classBooking.count as any).mockResolvedValue(0);
    (prisma.classBooking.findFirst as any).mockResolvedValue(null);
    (prisma.classBooking.create as any).mockResolvedValue({ id: 'booking-1' });

    await createBooking(req, mockRes);

    expect(prisma.gymClass.findFirst).toHaveBeenCalledWith({
      where: { id: classId, gym_id: gymId },
    });
    expect(prisma.classBooking.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ gym_id: gymId, class_id: classId }),
      }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(201);
  });
});

// ──────────────────────────────────────────────────────────────
describe('cancelBooking', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => vi.clearAllMocks());

  it('devuelve 404 si la reserva no pertenece al usuario ni al gym', async () => {
    (prisma.classBooking.findFirst as any).mockResolvedValue(null);
    const req: any = {
      gymId: 'gym-1',
      user: { id: 'user-1' },
      params: { id: 'booking-X' },
    };
    await cancelBooking(req, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it('devuelve 400 si la reserva ya está cancelada', async () => {
    (prisma.classBooking.findFirst as any).mockResolvedValue({
      id: 'b-1',
      status: 'CANCELLED',
    });
    const req: any = {
      gymId: 'gym-1',
      user: { id: 'user-1' },
      params: { id: 'b-1' },
    };
    await cancelBooking(req, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('already cancelled') }),
    );
  });

  it('cancela la reserva correctamente verificando ownership (gym + user)', async () => {
    (prisma.classBooking.findFirst as any).mockResolvedValue({
      id: 'b-1',
      status: 'PENDING',
    });
    (prisma.classBooking.update as any).mockResolvedValue({ id: 'b-1', status: 'CANCELLED' });
    const req: any = {
      gymId: 'gym-1',
      user: { id: 'user-1' },
      params: { id: 'b-1' },
    };
    await cancelBooking(req, mockRes);
    // Verifica que usó gym_id + user_id en la búsqueda (no puede cancelar reservas de otro)
    expect(prisma.classBooking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ gym_id: 'gym-1', user_id: 'user-1' }),
      }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });
});

// ──────────────────────────────────────────────────────────────
describe('markAttendance', () => {
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  beforeEach(() => vi.clearAllMocks());

  it('devuelve 404 si la reserva no existe en el gym', async () => {
    (prisma.classBooking.findFirst as any).mockResolvedValue(null);
    const req: any = { gymId: 'gym-1', params: { id: 'b-X' } };
    await markAttendance(req, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it('devuelve 400 si la reserva no está en estado PENDING', async () => {
    (prisma.classBooking.findFirst as any).mockResolvedValue({
      id: 'b-1',
      status: 'ATTENDED',
    });
    const req: any = { gymId: 'gym-1', params: { id: 'b-1' } };
    await markAttendance(req, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it('marca la reserva como ATTENDED correctamente', async () => {
    (prisma.classBooking.findFirst as any).mockResolvedValue({
      id: 'b-1',
      status: 'PENDING',
    });
    (prisma.classBooking.update as any).mockResolvedValue({ id: 'b-1', status: 'ATTENDED' });
    const req: any = { gymId: 'gym-1', params: { id: 'b-1' } };
    await markAttendance(req, mockRes);
    expect(prisma.classBooking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b-1' },
        data: expect.objectContaining({ status: 'ATTENDED' }),
      }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });
});
