import { SubscriptionTier } from '@prisma/client';
import { z } from 'zod';

export const createGymSchema = z.object({
  name: z.string().min(2, { message: 'Gym name must have at least 2 characters.' }),
  theme_colors: z.record(z.string(), z.unknown()).optional(),
  subscription_tier: z.nativeEnum(SubscriptionTier).optional(),
  n8n_config: z.record(z.string(), z.unknown()).optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
});

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
