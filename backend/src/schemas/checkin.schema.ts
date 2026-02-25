import { z } from 'zod';

const uuidSchema = z.string().uuid({ message: 'userId debe ser un UUID válido' });

/**
 * Acepta userId (UUID) o code: QR del socio (GYM_QR_<qr_token>).
 * El qr_token se genera al alta y se envía por WhatsApp con la bienvenida.
 */
export const checkinSchema = z
  .object({
    userId: uuidSchema.optional(),
    code: z.string().min(1).optional(),
    accessMethod: z.enum(['MANUAL', 'QR']).optional(),
  })
  .refine((data) => data.userId != null || (data.code != null && data.code.trim().length > 0), {
    message: 'Debe enviar userId o code (código escaneado del QR del socio).',
  })
  .transform((data) => ({
    userId: data.userId as string | undefined,
    code: data.code?.trim(),
    accessMethod: data.accessMethod,
  }));

export const courtesyCheckinSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(3, { message: "La razón debe tener al menos 3 caracteres" }),
});

export const subscriptionSchema = z.object({
  months: z.number().min(1),
  allowed_start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  allowed_end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
});
