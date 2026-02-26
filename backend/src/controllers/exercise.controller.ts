import { Request, Response } from 'express';
import { prisma } from '../db';
import { handleControllerError } from '../utils/http';
import { z } from 'zod';

const createExerciseSchema = z.object({
  name: z.string().min(2, { message: 'Exercise name must have at least 2 characters.' }),
  category: z.string().optional().nullable(),
});

// GET /exercises — List exercises for the gym (optional ?q= and ?category=)
export const listExercises = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const q = String(req.query.q ?? '').trim();
    const category = String(req.query.category ?? '').trim();

    const where: { gym_id: string; name?: { contains: string; mode: 'insensitive' }; category?: string | null } = {
      gym_id: gymId,
    };
    if (q.length >= 2) {
      where.name = { contains: q, mode: 'insensitive' };
    }
    if (category.length > 0) {
      where.category = category;
    }

    const exercises = await prisma.exercise.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take: 100,
    });

    res.status(200).json({ data: exercises });
  } catch (error) {
    handleControllerError(req, res, error, '[listExercises Error]', 'Failed to fetch exercises.');
  }
};

// POST /exercises — Create exercise in catalog (Coach/Admin)
export const createExercise = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const validation = createExerciseSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const { name, category } = validation.data;
    const exercise = await prisma.exercise.create({
      data: {
        gym_id: gymId,
        name: name.trim(),
        category: category?.trim() || null,
      },
    });

    res.status(201).json(exercise);
  } catch (error) {
    handleControllerError(req, res, error, '[createExercise Error]', 'Failed to create exercise.');
  }
};
