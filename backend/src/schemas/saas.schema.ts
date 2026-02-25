import { SubscriptionTier } from '@prisma/client';
import { z } from 'zod';

export const createGymSchema = z
  .object({
    name: z.string().min(2, { message: 'Gym name must have at least 2 characters.' }),
    theme_colors: z.record(z.string(), z.unknown()).optional(),
    subscription_tier: z.nativeEnum(SubscriptionTier).optional(),
    n8n_config: z.record(z.string(), z.unknown()).optional(),
    logo_url: z.string().url().optional().or(z.literal('')),
    /** Email del primer administrador del gym (creado en Supabase Auth + User en DB). */
    admin_email: z.string().email({ message: 'Invalid admin email.' }).optional(),
    /** Contraseña del admin (mín. 6 caracteres). Requerido si admin_email está presente. */
    admin_password: z.string().min(6, { message: 'Admin password must have at least 6 characters.' }).optional(),
    /** Nombre del admin (opcional). */
    admin_name: z.string().min(1).optional().nullable(),
  })
  .refine(
    (data) => {
      const hasEmail = data.admin_email != null && data.admin_email !== '';
      const hasPassword = data.admin_password != null && data.admin_password !== '';
      if (hasEmail && !hasPassword) return false;
      if (hasPassword && !hasEmail) return false;
      return true;
    },
    { message: 'admin_email and admin_password must be provided together.', path: ['admin_password'] },
  );

export const updateGymTierSchema = z.object({
  subscription_tier: z.nativeEnum(SubscriptionTier, {
    message: 'Valid subscription_tier is required.',
  }),
});

/** Override de módulos por gym (SuperAdmin). Cada key opcional; al menos una. */
export const updateGymModulesSchema = z
  .object({
    pos: z.boolean().optional(),
    qr_access: z.boolean().optional(),
    gamification: z.boolean().optional(),
    classes: z.boolean().optional(),
    biometrics: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one module key must be provided.',
  });

export const updateGymSchema = z.object({
  name: z.string().min(2, { message: 'Gym name must have at least 2 characters.' }).optional(),
  theme_colors: z.record(z.string(), z.unknown()).optional(),
  n8n_config: z.record(z.string(), z.unknown()).optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided to update.',
});

const GYM_STATUSES = ['ACTIVE', 'SUSPENDED', 'CANCELLED'] as const;
export const updateGymStatusSchema = z.object({
  status: z.enum(GYM_STATUSES, { message: 'status must be ACTIVE, SUSPENDED or CANCELLED' }),
});
