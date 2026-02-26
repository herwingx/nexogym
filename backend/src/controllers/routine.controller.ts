import { Request, Response } from 'express';
import { prisma } from '../db';
import { createRoutineSchema, updateRoutineSchema, addExerciseSchema, updateExerciseSchema, duplicateRoutineSchema } from '../schemas/routine.schema';
import { handleControllerError } from '../utils/http';

// POST /routines — Admin/Instructor crea rutina (plantilla base o asignada a socio)
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

    const { userId, name, description, exercises } = validation.data;

    // Si se envía userId, verificar que el socio existe en el gym
    if (userId) {
      const member = await prisma.user.findFirst({
        where: { id: userId, gym_id: gymId, deleted_at: null },
        select: { id: true, name: true },
      });
      if (!member) {
        res.status(404).json({ error: 'Member not found in this gym.' });
        return;
      }
    }

    const routine = await prisma.$transaction(async (tx) => {
      const created = await tx.routine.create({
        data: {
          gym_id: gymId,
          user_id: userId ?? null,
          name,
          description: description ?? null,
        },
      });
      if (exercises.length > 0) {
        await tx.workoutExercise.createMany({
          data: exercises.map((ex) => ({
            routine_id: created.id,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight ?? null,
            notes: ex.notes ?? null,
          })),
        });
      }
      return created.id;
    });

    const routineWithExercises = await prisma.routine.findUnique({
      where: { id: routine },
      include: {
        exercises: true,
        user: { select: { id: true, name: true } },
      },
    });
    if (!routineWithExercises) {
      res.status(500).json({ error: 'Failed to load created routine.' });
      return;
    }
    const { user, ...r } = routineWithExercises;
    const payload = { ...r, user_name: user?.name ?? null };
    res.status(201).json(payload);
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

// PATCH /routines/:id/exercises/:exerciseId — Update exercise
export const updateExercise = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const routineId = req.params.id as string;
    const exerciseId = req.params.exerciseId as string;

    const validation = updateExerciseSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

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

    const data = validation.data;
    const updated = await prisma.workoutExercise.update({
      where: { id: exerciseId },
      data: {
        ...(data.name != null && { name: data.name }),
        ...(data.sets != null && { sets: data.sets }),
        ...(data.reps != null && { reps: data.reps }),
        ...(data.weight !== undefined && { weight: data.weight }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    res.status(200).json({ message: 'Exercise updated.', exercise: updated });
  } catch (error) {
    handleControllerError(req, res, error, '[updateExercise Error]', 'Failed to update exercise.');
  }
};

// POST /routines/:id/duplicate — Duplicate routine and assign to one or more members
export const duplicateRoutine = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;

    const validation = duplicateRoutineSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const sourceRoutine = await prisma.routine.findFirst({
      where: { id, gym_id: gymId },
      include: { exercises: true },
    });

    if (!sourceRoutine) {
      res.status(404).json({ error: 'Routine not found.' });
      return;
    }

    const { userIds } = validation.data;

    const members = await prisma.user.findMany({
      where: { id: { in: userIds }, gym_id: gymId, deleted_at: null },
      select: { id: true },
    });

    const validIds = new Set(members.map((m) => m.id));
    const invalidIds = userIds.filter((u) => !validIds.has(u));
    if (invalidIds.length > 0) {
      res.status(400).json({ error: `Members not found: ${invalidIds.join(', ')}` });
      return;
    }

    const created: { id: string; user_id: string }[] = [];

    for (const userId of userIds) {
      const createdRoutine = await prisma.routine.create({
        data: {
          gym_id: gymId,
          user_id: userId,
          name: sourceRoutine.name,
          description: sourceRoutine.description,
        },
      });
      if (sourceRoutine.exercises.length > 0) {
        await prisma.workoutExercise.createMany({
          data: sourceRoutine.exercises.map((ex) => ({
            routine_id: createdRoutine.id,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            notes: ex.notes,
          })),
        });
      }
      created.push({ id: createdRoutine.id, user_id: userId });
    }

    const routinesWithDetails = await prisma.routine.findMany({
      where: { id: { in: created.map((c) => c.id) } },
      include: {
        exercises: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const data = routinesWithDetails.map(({ user, ...r }) => ({
      ...r,
      user_name: user?.name ?? null,
    }));

    res.status(201).json({ message: 'Routines assigned.', data });
  } catch (error) {
    handleControllerError(req, res, error, '[duplicateRoutine Error]', 'Failed to duplicate routine.');
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
