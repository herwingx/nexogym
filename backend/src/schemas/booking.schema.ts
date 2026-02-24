import { z } from 'zod';

export const classSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  instructorId: z.string().uuid(),
  capacity: z.number().int().positive(),
  day_of_week: z.number().int().min(0).max(6), // 0=Domingo
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
});

export const bookingSchema = z.object({
  classId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
});
