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
