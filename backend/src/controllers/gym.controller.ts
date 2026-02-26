import { Request, Response } from 'express';
import { prisma } from '../db';
import { handleControllerError } from '../utils/http';
import { updateRewardsConfigSchema, updateThemeColorsSchema, updateOpeningConfigSchema } from '../schemas/gym.schema';
import type { Prisma } from '@prisma/client';

/**
 * GET /gym/rewards-config
 * Devuelve la configuración de premios por racha del gym (solo admin, solo si gamificación activa).
 */
export const getRewardsConfig = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { rewards_config: true },
    });

    if (!gym) {
      res.status(404).json({ error: 'Gym not found.' });
      return;
    }

    const config = gym.rewards_config as Record<string, unknown> | null;
    const streakRewards = Array.isArray(config?.streak_rewards)
      ? (config.streak_rewards as { days: number; label: string }[])
      : [];
    const rawFreeze = config?.streak_freeze_days;
    const streakFreezeDays =
      typeof rawFreeze === 'number' && rawFreeze >= 1 && rawFreeze <= 90 ? rawFreeze : 7;

    res.status(200).json({
      streak_rewards: streakRewards,
      streak_freeze_days: streakFreezeDays,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getRewardsConfig Error]', 'Failed to load rewards config.');
  }
};

/**
 * PATCH /gym/rewards-config
 * Actualiza la configuración de premios por racha (solo admin, solo si gamificación activa).
 */
export const updateRewardsConfig = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const validation = updateRewardsConfigSchema.safeParse(req.body);
    if (!validation.success) {
      const first = validation.error.issues[0];
      res.status(400).json({ error: first.message });
      return;
    }

    const { streak_rewards, streak_freeze_days } = validation.data;

    const existing = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { id: true, rewards_config: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Gym not found.' });
      return;
    }

    const current = (existing.rewards_config as Record<string, unknown>) ?? {};
    const updated: Record<string, unknown> = {
      ...current,
      streak_rewards: streak_rewards.map((r) => ({ days: r.days, label: r.label })),
      ...(streak_freeze_days != null && { streak_freeze_days: streak_freeze_days }),
    };

    await prisma.gym.update({
      where: { id: gymId },
      data: { rewards_config: updated as Prisma.InputJsonValue },
    });

    res.status(200).json({
      streak_rewards: updated.streak_rewards,
      streak_freeze_days: updated.streak_freeze_days ?? 7,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[updateRewardsConfig Error]', 'Failed to update rewards config.');
  }
};

/**
 * GET /gym/opening-config
 * Devuelve los días que el gym cierra (no afectan la racha).
 */
export const getOpeningConfig = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { opening_config: true },
    });

    if (!gym) {
      res.status(404).json({ error: 'Gym not found.' });
      return;
    }

    const config = gym.opening_config as Record<string, unknown> | null;
    const rawWk = Array.isArray(config?.closed_weekdays) ? config.closed_weekdays : [];
    const closedWeekdays = rawWk
      .filter((v): v is number => typeof v === 'number' && v >= 0 && v <= 6)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => a - b);
    const rawDt = Array.isArray(config?.closed_dates) ? config.closed_dates : [];
    const closedDates = rawDt
      .filter((v): v is string => typeof v === 'string' && /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(v))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort();

    res.status(200).json({ closed_weekdays: closedWeekdays, closed_dates: closedDates });
  } catch (error) {
    handleControllerError(req, res, error, '[getOpeningConfig Error]', 'Failed to load opening config.');
  }
};

/**
 * PATCH /gym/opening-config
 * Actualiza los días que el gym cierra (no afectan la racha de socios).
 */
export const updateOpeningConfig = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const validation = updateOpeningConfigSchema.safeParse(req.body);
    if (!validation.success) {
      const first = validation.error.issues[0];
      res.status(400).json({ error: first.message });
      return;
    }

    const { closed_weekdays, closed_dates } = validation.data;
    const uniqueWeekdays = [...new Set(closed_weekdays)].sort((a, b) => a - b);
    const uniqueDates = [...new Set(closed_dates)].sort();

    await prisma.gym.update({
      where: { id: gymId },
      data: {
        opening_config: { closed_weekdays: uniqueWeekdays, closed_dates: uniqueDates } as Prisma.InputJsonValue,
      },
    });

    res.status(200).json({ closed_weekdays: uniqueWeekdays, closed_dates: uniqueDates });
  } catch (error) {
    handleControllerError(req, res, error, '[updateOpeningConfig Error]', 'Failed to update opening config.');
  }
};

/**
 * PATCH /gym/theme-colors
 * Admin actualiza el color de acento de su gym (white-label).
 * SuperAdmin no tiene gym_id, usa /saas/gyms/:id.
 */
export const updateThemeColors = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const validation = updateThemeColorsSchema.safeParse(req.body);
    if (!validation.success) {
      const first = validation.error.issues[0];
      res.status(400).json({ error: first.message });
      return;
    }

    const { primary } = validation.data;

    await prisma.gym.update({
      where: { id: gymId },
      data: { theme_colors: { primary } as Prisma.InputJsonValue },
    });

    res.status(200).json({
      message: 'Theme colors updated.',
      theme_colors: { primary },
    });
  } catch (error) {
    handleControllerError(req, res, error, '[updateThemeColors Error]', 'Failed to update theme colors.');
  }
};
