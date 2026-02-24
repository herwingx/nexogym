import { Request, Response } from 'express';
import { prisma } from '../db';
import { createRoutineSchema, updateRoutineSchema, addExerciseSchema } from '../schemas/routine.schema';
import { handleControllerError } from '../utils/http';

// POST /routines — Admin/Instructor crea rutina para un socio
export const createRoutine = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const validation = createRoutineSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const { userId, name, description } = validation.data;

    // Verify the target user belongs to this gym
    const member = await prisma.user.findFirst({
      where: { id: userId, gym_id: gymId, deleted_at: null },
    });

    if (!member) {
      res.status(404).json({ error: 'Member not found in this gym.' });
      return;
    }

    const routine = await prisma.routine.create({
      data: {
        gym_id: gymId,
        user_id: userId,
        name,
        description: description ?? null,
      },
    });

    res.status(201).json({ message: 'Routine created.', routine });
  } catch (error) {
    handleControllerError(req, res, error, '[createRoutine Error]', 'Failed to create routine.');
  }
};

// GET /routines — Admin lista todas las rutinas del gym
export const listRoutines = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const routines = await prisma.routine.findMany({
      where: { gym_id: gymId },
      include: {
        exercises: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const data = routines.map(({ user, ...r }) => ({
      ...r,
      user_name: user?.name,
    }));

    res.status(200).json({ data });
  } catch (error) {
    handleControllerError(req, res, error, '[listRoutines Error]', 'Failed to fetch routines.');
  }
};

// GET /routines/me — El socio consulta sus rutinas
export const getMyRoutines = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const userId = req.user?.id;
    if (!gymId || !userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const routines = await prisma.routine.findMany({
      where: { gym_id: gymId, user_id: userId },
      include: { exercises: true },
      orderBy: { created_at: 'desc' },
    });

    res.status(200).json({ data: routines });
  } catch (error) {
    handleControllerError(req, res, error, '[getMyRoutines Error]', 'Failed to fetch routines.');
  }
};

// GET /routines/member/:userId — Admin ve rutinas de un socio específico
export const getMemberRoutines = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const userId = req.params.userId as string;

    const member = await prisma.user.findFirst({
      where: { id: userId, gym_id: gymId, deleted_at: null },
      select: { id: true, name: true },
    });

    if (!member) {
      res.status(404).json({ error: 'Member not found in this gym.' });
      return;
    }

    const routines = await prisma.routine.findMany({
      where: { gym_id: gymId, user_id: userId },
      include: { exercises: true },
      orderBy: { created_at: 'desc' },
    });

    res.status(200).json({ member, data: routines });
  } catch (error) {
    handleControllerError(req, res, error, '[getMemberRoutines Error]', 'Failed to fetch member routines.');
  }
};

// PATCH /routines/:id — Update routine name/description
export const updateRoutine = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;

    const validation = updateRoutineSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const existing = await prisma.routine.findFirst({ where: { id, gym_id: gymId } });
    if (!existing) {
      res.status(404).json({ error: 'Routine not found.' });
      return;
    }

    const updated = await prisma.routine.update({
      where: { id },
      data: validation.data,
    });

    res.status(200).json({ message: 'Routine updated.', routine: updated });
  } catch (error) {
    handleControllerError(req, res, error, '[updateRoutine Error]', 'Failed to update routine.');
  }
};

// DELETE /routines/:id — Delete routine (cascades exercises)
export const deleteRoutine = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;

    const existing = await prisma.routine.findFirst({ where: { id, gym_id: gymId } });
    if (!existing) {
      res.status(404).json({ error: 'Routine not found.' });
      return;
    }

    await prisma.routine.delete({ where: { id } });

    res.status(200).json({ message: `Routine "${existing.name}" deleted.` });
  } catch (error) {
    handleControllerError(req, res, error, '[deleteRoutine Error]', 'Failed to delete routine.');
  }
};

// POST /routines/:id/exercises — Add exercise to routine
export const addExercise = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const routineId = req.params.id as string;

    const validation = addExerciseSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const routine = await prisma.routine.findFirst({ where: { id: routineId, gym_id: gymId } });
    if (!routine) {
      res.status(404).json({ error: 'Routine not found.' });
      return;
    }

    const exercise = await prisma.workoutExercise.create({
      data: {
        routine_id: routineId,
        ...validation.data,
        weight: validation.data.weight ?? null,
        notes: validation.data.notes ?? null,
      },
    });

    res.status(201).json({ message: 'Exercise added.', exercise });
  } catch (error) {
    handleControllerError(req, res, error, '[addExercise Error]', 'Failed to add exercise.');
  }
};

// DELETE /routines/:id/exercises/:exerciseId — Remove exercise
export const removeExercise = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const routineId = req.params.id as string;
    const exerciseId = req.params.exerciseId as string;

    const routine = await prisma.routine.findFirst({ where: { id: routineId, gym_id: gymId } });
    if (!routine) {
      res.status(404).json({ error: 'Routine not found.' });
      return;
    }

    const exercise = await prisma.workoutExercise.findFirst({
      where: { id: exerciseId, routine_id: routineId },
    });
    if (!exercise) {
      res.status(404).json({ error: 'Exercise not found.' });
      return;
    }

    await prisma.workoutExercise.delete({ where: { id: exerciseId } });

    res.status(200).json({ message: 'Exercise removed.' });
  } catch (error) {
    handleControllerError(req, res, error, '[removeExercise Error]', 'Failed to remove exercise.');
  }
};
