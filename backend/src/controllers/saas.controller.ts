import { Request, Response } from 'express';
import { prisma } from '../db';
import crypto from 'crypto';
import { Prisma, SubscriptionTier } from '@prisma/client';
import {
  createGymSchema,
  updateGymSchema,
  updateGymTierSchema,
  updateGymModulesSchema,
} from '../schemas/saas.schema';
import { handleControllerError } from '../utils/http';
import {
  DEFAULT_MODULES_CONFIG_BY_TIER,
  type ModulesConfig,
  resolveModulesConfig,
} from '../utils/modules-config';

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

// GET /saas/gyms
export const listGyms = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
    const skip = (page - 1) * limit;
    const q = String(req.query.q ?? '').trim();

    const where = q.length >= 2
      ? { name: { contains: q, mode: 'insensitive' as const } }
      : {};

    const [gyms, total] = await Promise.all([
      prisma.gym.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          subscription_tier: true,
          modules_config: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: {
              users: true,
              subscriptions: true,
            },
          },
        },
      }),
      prisma.gym.count({ where }),
    ]);

    res.status(200).json({
      data: gyms,
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    handleControllerError(req, res, error, '[listGyms Error]', 'Failed to list gyms.');
  }
};

// GET /saas/gyms/:id
export const getGymDetail = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const gym = await prisma.gym.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            subscriptions: true,
            visits: true,
            sales: true,
          },
        },
      },
    });

    if (!gym) {
      res.status(404).json({ error: 'Gym not found.' });
      return;
    }

    const activeSubscriptions = await prisma.subscription.count({
      where: { gym_id: id, status: 'ACTIVE' },
    });

    res.status(200).json({ gym: { ...gym, active_subscriptions: activeSubscriptions } });
  } catch (error) {
    handleControllerError(req, res, error, '[getGymDetail Error]', 'Failed to retrieve gym detail.');
  }
};

// PATCH /saas/gyms/:id
export const updateGym = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const validation = updateGymSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const { name, theme_colors, n8n_config } = validation.data;

    const existing = await prisma.gym.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Gym not found.' });
      return;
    }

    const gym = await prisma.gym.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(theme_colors !== undefined && { theme_colors: theme_colors as Prisma.InputJsonValue }),
        ...(n8n_config !== undefined && { n8n_config: n8n_config as Prisma.InputJsonValue }),
      },
    });

    res.status(200).json({ message: 'Gym updated successfully.', gym });
  } catch (error) {
    handleControllerError(req, res, error, '[updateGym Error]', 'Failed to update gym.');
  }
};

// DELETE /saas/gyms/:id
// Requiere header: x-confirm-delete: CONFIRM_DELETE
export const deleteGym = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const confirmation = req.headers['x-confirm-delete'];

    if (confirmation !== 'CONFIRM_DELETE') {
      res.status(400).json({
        error: 'Confirmation required. Send header x-confirm-delete: CONFIRM_DELETE to proceed.',
      });
      return;
    }

    const existing = await prisma.gym.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!existing) {
      res.status(404).json({ error: 'Gym not found.' });
      return;
    }

    // Hard delete — Prisma cascade elimina todos los datos del tenant
    await prisma.gym.delete({ where: { id } });

    res.status(200).json({
      message: `Gym "${existing.name}" and all associated data have been permanently deleted.`,
      deleted_gym_id: id,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[deleteGym Error]', 'Failed to delete gym.');
  }
};

// GET /saas/gyms/:id/export
export const exportGymData = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const gym = await prisma.gym.findUnique({ where: { id } });
    if (!gym) {
      res.status(404).json({ error: 'Gym not found.' });
      return;
    }

    const [users, subscriptions, visits, products, sales, cashShifts, classes, bookings, routines, auditLogs] =
      await Promise.all([
        prisma.user.findMany({ where: { gym_id: id } }),
        prisma.subscription.findMany({ where: { gym_id: id } }),
        prisma.visit.findMany({ where: { gym_id: id } }),
        prisma.product.findMany({ where: { gym_id: id } }),
        prisma.sale.findMany({ where: { gym_id: id }, include: { items: true } }),
        prisma.cashShift.findMany({ where: { gym_id: id }, include: { expenses: true } }),
        prisma.gymClass.findMany({ where: { gym_id: id } }),
        prisma.classBooking.findMany({ where: { gym_id: id } }),
        prisma.routine.findMany({ where: { gym_id: id }, include: { exercises: true } }),
        prisma.auditLog.findMany({ where: { gym_id: id }, orderBy: { created_at: 'desc' } }),
      ]);

    res.status(200).json({
      generated_at: new Date().toISOString(),
      gym,
      stats: {
        total_users: users.length,
        total_subscriptions: subscriptions.length,
        total_visits: visits.length,
        total_sales: sales.length,
      },
      users,
      subscriptions,
      visits,
      products,
      sales,
      cash_shifts: cashShifts,
      classes,
      bookings,
      routines,
      audit_logs: auditLogs,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[exportGymData Error]', 'Failed to export gym data.');
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

// PATCH /saas/gyms/:id/modules — override de módulos por gym (SuperAdmin)
export const updateGymModules = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const validation = updateGymModulesSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const gym = await prisma.gym.findUnique({
      where: { id },
      select: { id: true, subscription_tier: true, modules_config: true },
    });

    if (!gym) {
      res.status(404).json({ error: 'Gym not found.' });
      return;
    }

    const currentResolved = resolveModulesConfig(
      gym.modules_config,
      gym.subscription_tier,
    ) as ModulesConfig;
    const merged: ModulesConfig = { ...currentResolved, ...validation.data };

    await prisma.gym.update({
      where: { id },
      data: { modules_config: merged as Prisma.InputJsonValue },
    });

    res.status(200).json({
      message: 'Gym modules updated.',
      modules_config: merged,
    });
  } catch (error) {
    handleControllerError(
      req,
      res,
      error,
      '[updateGymModules Error]',
      'Failed to update gym modules.',
    );
  }
};
