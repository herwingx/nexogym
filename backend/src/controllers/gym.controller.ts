import { Request, Response } from 'express';
import { prisma } from '../db';
import { handleControllerError } from '../utils/http';
import { updateRewardsConfigSchema } from '../schemas/gym.schema';
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

    res.status(200).json({
      streak_rewards: streakRewards,
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

    const { streak_rewards } = validation.data;

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
    };

    await prisma.gym.update({
      where: { id: gymId },
      data: { rewards_config: updated as Prisma.InputJsonValue },
    });

    res.status(200).json({
      streak_rewards: updated.streak_rewards,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[updateRewardsConfig Error]', 'Failed to update rewards config.');
  }
};
