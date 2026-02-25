import { Request, Response } from 'express';
import { prisma } from '../db';
import { Role } from '@prisma/client';
import { handleControllerError } from '../utils/http';

/**
 * GET /api/v1/integrations/birthdays?date=YYYY-MM-DD
 * Devuelve usuarios con rol MEMBER cuyo día y mes de nacimiento coinciden con la fecha.
 * Protegido: Admin o SuperAdmin. Si hay gymId (Admin), filtra por ese gym.
 */
export const getBirthdays = async (req: Request, res: Response) => {
  try {
    const raw = req.query.date as string | undefined;
    const dateStr = raw?.trim() || new Date().toISOString().split('T')[0];
    const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!parsed) {
      res.status(400).json({ error: 'Query date must be YYYY-MM-DD' });
      return;
    }
    const monthNum = parseInt(parsed[2], 10);
    const dayNum = parseInt(parsed[3], 10);

    const gymId = req.gymId;
    const where = {
      role: Role.MEMBER as const,
      deleted_at: null,
      birth_date: { not: null },
      ...(gymId && { gym_id: gymId }),
    };

    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, phone: true, gym_id: true, birth_date: true },
    });

    const matching = users.filter((u) => {
      if (!u.birth_date) return false;
      const d = u.birth_date as Date;
      return d.getUTCMonth() + 1 === monthNum && d.getUTCDate() === dayNum;
    });

    res.status(200).json({
      date: dateStr,
      data: matching.map((u) => ({ id: u.id, name: u.name, phone: u.phone, gym_id: u.gym_id })),
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getBirthdays Error]', 'Failed to fetch birthdays.');
  }
};
