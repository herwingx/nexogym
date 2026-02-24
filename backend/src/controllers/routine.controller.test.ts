import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoutine, getMyRoutines, getMemberRoutines, updateRoutine, deleteRoutine } from './routine.controller';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    routine: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const mockRes = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
});

describe('routine.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────
  // createRoutine
  // ──────────────────────────────────────────────────────────────
  describe('createRoutine', () => {
    it('devuelve 401 si falta gymId', async () => {
      const req: any = { gymId: undefined, body: {} };
      const res = mockRes();
      await createRoutine(req, res as any);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('devuelve 400 si el body no pasa validación Zod', async () => {
      const req: any = { gymId: 'gym-1', body: { name: 'Rutina sin userId' } };
      const res = mockRes();
      await createRoutine(req, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devuelve 404 si el socio no pertenece al gym', async () => {
      (prisma.user.findFirst as any).mockResolvedValue(null);
      const req: any = {
        gymId: 'gym-1',
        body: { userId: '550e8400-e29b-41d4-a716-446655440000', name: 'Rutina A' },
      };
      const res = mockRes();
      await createRoutine(req, res as any);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Member not found') }));
    });

    it('crea la rutina y la vincula al gym correcto', async () => {
      (prisma.user.findFirst as any).mockResolvedValue({ id: 'user-1', gym_id: 'gym-1' });
      (prisma.routine.create as any).mockResolvedValue({ id: 'routine-1', name: 'Fuerza' });
      const req: any = {
        gymId: 'gym-1',
        body: { userId: '550e8400-e29b-41d4-a716-446655440001', name: 'Fuerza', description: 'Rutina de fuerza' },
      };
      const res = mockRes();
      await createRoutine(req, res as any);
      expect(prisma.routine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gym_id: 'gym-1', user_id: '550e8400-e29b-41d4-a716-446655440001', name: 'Fuerza' }),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // getMyRoutines
  // ──────────────────────────────────────────────────────────────
  describe('getMyRoutines', () => {
    it('devuelve 401 si falta gymId o userId', async () => {
      const req: any = { gymId: undefined, user: undefined };
      const res = mockRes();
      await getMyRoutines(req, res as any);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('consulta rutinas filtrando por gym_id y user_id del JWT', async () => {
      const gymId = 'gym-1';
      const userId = 'user-1';
      const fakeRoutines = [{ id: 'r-1', name: 'Fuerza', exercises: [] }];
      (prisma.routine.findMany as any).mockResolvedValue(fakeRoutines);

      const req: any = { gymId, user: { id: userId } };
      const res = mockRes();
      await getMyRoutines(req, res as any);

      expect(prisma.routine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ gym_id: gymId, user_id: userId }),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ data: fakeRoutines });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // getMemberRoutines
  // ──────────────────────────────────────────────────────────────
  describe('getMemberRoutines', () => {
    it('devuelve 404 si el socio no existe en el gym', async () => {
      (prisma.user.findFirst as any).mockResolvedValue(null);
      const req: any = {
        gymId: 'gym-1',
        params: { userId: 'no-existe' },
      };
      const res = mockRes();
      await getMemberRoutines(req, res as any);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('devuelve las rutinas del socio indicado con aislamiento de tenant', async () => {
      const gymId = 'gym-1';
      const memberId = 'member-2';
      (prisma.user.findFirst as any).mockResolvedValue({ id: memberId, name: 'Carlos' });
      (prisma.routine.findMany as any).mockResolvedValue([{ id: 'r-2', exercises: [] }]);

      const req: any = { gymId, params: { userId: memberId } };
      const res = mockRes();
      await getMemberRoutines(req, res as any);

      expect(prisma.routine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ gym_id: gymId, user_id: memberId }),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // updateRoutine
  // ──────────────────────────────────────────────────────────────
  describe('updateRoutine', () => {
    it('devuelve 404 si la rutina no pertenece al gym', async () => {
      (prisma.routine.findFirst as any).mockResolvedValue(null);
      const req: any = {
        gymId: 'gym-1',
        params: { id: 'routine-X' },
        body: { name: 'Nuevo nombre' },
      };
      const res = mockRes();
      await updateRoutine(req, res as any);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('actualiza solo los campos enviados', async () => {
      (prisma.routine.findFirst as any).mockResolvedValue({ id: 'r-1', gym_id: 'gym-1' });
      (prisma.routine.update as any).mockResolvedValue({ id: 'r-1', name: 'Nuevo' });

      const req: any = {
        gymId: 'gym-1',
        params: { id: 'r-1' },
        body: { name: 'Nuevo' },
      };
      const res = mockRes();
      await updateRoutine(req, res as any);
      expect(prisma.routine.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'r-1' } }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // deleteRoutine
  // ──────────────────────────────────────────────────────────────
  describe('deleteRoutine', () => {
    it('devuelve 404 si la rutina no pertenece al gym', async () => {
      (prisma.routine.findFirst as any).mockResolvedValue(null);
      const req: any = { gymId: 'gym-1', params: { id: 'r-X' } };
      const res = mockRes();
      await deleteRoutine(req, res as any);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('elimina la rutina correctamente', async () => {
      (prisma.routine.findFirst as any).mockResolvedValue({ id: 'r-1' });
      (prisma.routine.delete as any).mockResolvedValue({});
      const req: any = { gymId: 'gym-1', params: { id: 'r-1' } };
      const res = mockRes();
      await deleteRoutine(req, res as any);
      expect(prisma.routine.delete).toHaveBeenCalledWith({ where: { id: 'r-1' } });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
