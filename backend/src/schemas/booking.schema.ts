import { z } from 'zod';

export const classSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  instructorId: z.string().uuid(),
  capacity: z.number().int().positive(),
  day_of_week: z.number().int().min(0).max(6), // 0=Domingo
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  price: z.number().positive().optional().nullable(),
});

export const updateClassSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  instructorId: z.string().uuid().optional(),
  capacity: z.number().int().positive().optional(),
  day_of_week: z.number().int().min(0).max(6).optional(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  price: z.number().positive().optional().nullable(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided.' });

export const bookingSchema = z.object({
  classId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
});
