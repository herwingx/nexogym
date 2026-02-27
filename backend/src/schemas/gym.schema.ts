import { z } from 'zod';

const streakRewardItemSchema = z.object({
  days: z.number().int().min(1, { message: 'days must be at least 1' }),
  label: z.string().min(1, { message: 'label is required' }).max(120, { message: 'label too long' }),
});

export const updateRewardsConfigSchema = z
  .object({
    streak_rewards: z
      .array(streakRewardItemSchema)
      .max(20, { message: 'Maximum 20 streak rewards allowed' }),
    streak_freeze_days: z.number().int().min(1).max(90).optional(),
  })
  .refine(
    (data) => {
      const days = new Set<number>();
      for (const r of data.streak_rewards) {
        if (days.has(r.days)) return false;
        days.add(r.days);
      }
      return true;
    },
    { message: 'Duplicate days in streak_rewards', path: ['streak_rewards'] }
  );

export type UpdateRewardsConfigBody = z.infer<typeof updateRewardsConfigSchema>;

const mmddRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

/** closed_weekdays: 0=Dom..6=Sab. closed_dates: festivos anuales ["01-01","12-25"] MM-DD. No afectan racha. */
export const updateOpeningConfigSchema = z.object({
  closed_weekdays: z
    .array(z.number().int().min(0).max(6))
    .max(7, { message: 'closed_weekdays max 7' })
    .optional()
    .default([]),
  closed_dates: z
    .array(z.string().regex(mmddRegex, { message: 'closed_dates debe ser MM-DD (ej. 01-01)' }))
    .max(30, { message: 'closed_dates max 30' })
    .optional()
    .default([]),
});

export type UpdateOpeningConfigBody = z.infer<typeof updateOpeningConfigSchema>;

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
export const updateThemeColorsSchema = z.object({
  primary: z
    .string()
    .min(1, { message: 'primary color is required' })
    .regex(hexColorRegex, { message: 'primary must be a valid hex color (e.g. #2563eb)' }),
});

/** Admin actualiza logo del gym (white-label). logo_url: URL pública, null o "" para quitar. */
export const updateLogoSchema = z.object({
  logo_url: z.union([z.string().url().min(1), z.literal(''), z.null()]),
});
