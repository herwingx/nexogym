import { z } from 'zod';

export const checkinSchema = z.object({
  userId: z.string().uuid({ message: "userId debe ser un UUID válido" }),
});

export const courtesyCheckinSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(3, { message: "La razón debe tener al menos 3 caracteres" }),
});

export const subscriptionSchema = z.object({
  months: z.number().min(1),
  allowed_start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  allowed_end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
});
