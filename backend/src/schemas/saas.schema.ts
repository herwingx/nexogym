import { SubscriptionTier } from '@prisma/client';
import { z } from 'zod';

export const createGymSchema = z.object({
  name: z.string().min(2, { message: 'Gym name must have at least 2 characters.' }),
  theme_colors: z.record(z.string(), z.unknown()).optional(),
  subscription_tier: z.nativeEnum(SubscriptionTier).optional(),
  n8n_config: z.record(z.string(), z.unknown()).optional(),
});

export const updateGymTierSchema = z.object({
  subscription_tier: z.nativeEnum(SubscriptionTier, {
    message: 'Valid subscription_tier is required.',
  }),
});

export const updateGymSchema = z.object({
  name: z.string().min(2, { message: 'Gym name must have at least 2 characters.' }).optional(),
  theme_colors: z.record(z.string(), z.unknown()).optional(),
  n8n_config: z.record(z.string(), z.unknown()).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided to update.',
});
