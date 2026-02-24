import { Request, Response } from 'express';
import { prisma } from '../db';
import crypto from 'crypto';
import { Prisma, SubscriptionTier } from '@prisma/client';
import { createGymSchema, updateGymTierSchema } from '../schemas/saas.schema';
import { handleControllerError } from '../utils/http';
import { DEFAULT_MODULES_CONFIG_BY_TIER, resolveModulesConfig } from '../utils/modules-config';

// POST /saas/gym
export const createGym = async (req: Request, res: Response) => {
  try {
    const validation = createGymSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const { name, theme_colors, subscription_tier, n8n_config } = validation.data;

    // Generate a secure, unique hardware API key
    const apiKeyHardware = crypto.randomBytes(32).toString('hex');
    const selectedTier: SubscriptionTier =
      subscription_tier && Object.values(SubscriptionTier).includes(subscription_tier)
        ? subscription_tier
        : SubscriptionTier.BASIC;

    const gym = await prisma.gym.create({
      data: {
        name,
        theme_colors: (theme_colors ?? {}) as Prisma.InputJsonValue,
        subscription_tier: selectedTier,
        modules_config: DEFAULT_MODULES_CONFIG_BY_TIER[selectedTier],
        n8n_config: n8n_config ? (n8n_config as Prisma.InputJsonValue) : undefined,
        api_key_hardware: apiKeyHardware,
      },
    });

    res.status(201).json({
      message: 'Gym created successfully.',
      gym,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[createGym Error]', 'Failed to create Gym.');
  }
};

// PATCH /saas/gym/:id/tier
export const updateGymTier = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const validation = updateGymTierSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const { subscription_tier } = validation.data;

    const gym = await prisma.gym.update({
      where: { id },
      data: {
        subscription_tier,
        modules_config: DEFAULT_MODULES_CONFIG_BY_TIER[subscription_tier],
      },
    });

    res.status(200).json({
      message: 'Gym subscription tier updated.',
      gym,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[updateGymTier Error]', 'Failed to update Gym tier.');
  }
};

// GET /saas/metrics
export const getGlobalMetrics = async (_req: Request, res: Response) => {
  try {
    const totalActiveGyms = await prisma.gym.count();

    res.status(200).json({
      total_active_gyms: totalActiveGyms,
    });
  } catch (error) {
    handleControllerError(_req, res, error, '[getGlobalMetrics Error]', 'Failed to retrieve global metrics.');
  }
};

// GET /saas/gyms/:id/modules
export const getGymModules = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const gym = await prisma.gym.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        modules_config: true,
      },
    });

    if (!gym) {
      res.status(404).json({ error: 'Gym not found.' });
      return;
    }

    res.status(200).json({
      gym_id: gym.id,
      gym_name: gym.name,
      subscription_tier: gym.subscription_tier,
      modules_config: resolveModulesConfig(gym.modules_config, gym.subscription_tier),
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getGymModules Error]', 'Failed to retrieve gym modules.');
  }
};
