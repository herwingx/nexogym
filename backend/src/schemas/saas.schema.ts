import { SubscriptionTier } from '@prisma/client';
import { z } from 'zod';

const modulesConfigSchema = z.record(z.string(), z.boolean());

export const createGymSchema = z.object({
  name: z.string().min(2, { message: 'Gym name must have at least 2 characters.' }),
  theme_colors: z.record(z.string(), z.unknown()).optional(),
  subscription_tier: z.nativeEnum(SubscriptionTier).optional(),
  modules_config: modulesConfigSchema.optional(),
});

export const updateGymTierSchema = z.object({
  subscription_tier: z.nativeEnum(SubscriptionTier, {
    message: 'Valid subscription_tier is required.',
  }),
});
