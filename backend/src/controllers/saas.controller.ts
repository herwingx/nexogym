import { Request, Response } from 'express';
import { prisma } from '../db';
import crypto from 'crypto';
import { SubscriptionTier } from '@prisma/client';
import { createGymSchema, updateGymTierSchema } from '../schemas/saas.schema';

const MODULES_CONFIG_BY_TIER: Record<SubscriptionTier, Record<string, boolean>> = {
  [SubscriptionTier.BASIC]: {
    pos: true,
    qr_access: false,
    gamification: false,
    classes: false,
  },
  [SubscriptionTier.PRO_QR]: {
    pos: true,
    qr_access: true,
    gamification: true,
    classes: true,
  },
  [SubscriptionTier.PREMIUM_BIO]: {
    pos: true,
    qr_access: true,
    gamification: true,
    classes: true,
    biometrics: true,
  },
};

// POST /saas/gym
export const createGym = async (req: Request, res: Response) => {
  try {
    const validation = createGymSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const { name, theme_colors, subscription_tier, modules_config } = validation.data;

    // Generate a secure, unique hardware API key
    const apiKeyHardware = crypto.randomBytes(32).toString('hex');
    const selectedTier: SubscriptionTier =
      subscription_tier && Object.values(SubscriptionTier).includes(subscription_tier)
        ? subscription_tier
        : SubscriptionTier.BASIC;

    const gym = await prisma.gym.create({
      data: {
        name,
        theme_colors: theme_colors || {},
        subscription_tier: selectedTier,
        modules_config: modules_config ?? MODULES_CONFIG_BY_TIER[selectedTier],
        api_key_hardware: apiKeyHardware,
      },
    });

    res.status(201).json({
      message: 'Gym created successfully.',
      gym,
    });
  } catch (error) {
    console.error('[createGym Error]:', error);
    res.status(500).json({ error: 'Failed to create Gym.' });
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
        modules_config: MODULES_CONFIG_BY_TIER[subscription_tier],
      },
    });

    res.status(200).json({
      message: 'Gym subscription tier updated.',
      gym,
    });
  } catch (error) {
    console.error('[updateGymTier Error]:', error);
    res.status(500).json({ error: 'Failed to update Gym tier.' });
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
    console.error('[getGlobalMetrics Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve global metrics.' });
  }
};
