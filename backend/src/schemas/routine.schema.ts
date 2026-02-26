import { z } from 'zod';

const exerciseItemSchema = z.object({
  name: z.string().min(2, { message: 'Exercise name is required.' }),
  sets: z.number().int().min(1),
  reps: z.number().int().min(1),
  weight: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const createRoutineSchema = z.object({
  userId: z.string().uuid({ message: 'Valid userId (UUID) is required.' }).optional().nullable(),
  name: z.string().min(2, { message: 'Routine name must have at least 2 characters.' }),
  description: z.string().optional().nullable(),
  exercises: z.array(exerciseItemSchema).optional().default([]),
});

export const updateRoutineSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided.' });

export const addExerciseSchema = z.object({
  name: z.string().min(2, { message: 'Exercise name is required.' }),
  sets: z.number().int().min(1),
  reps: z.number().int().min(1),
  weight: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const updateExerciseSchema = z.object({
  name: z.string().min(2).optional(),
  sets: z.number().int().min(1).optional(),
  reps: z.number().int().min(1).optional(),
  weight: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided.' });

export const duplicateRoutineSchema = z.object({
  userIds: z.array(z.string().uuid({ message: 'Valid userId (UUID) is required.' })).min(1, { message: 'Select at least one member.' }),
});
