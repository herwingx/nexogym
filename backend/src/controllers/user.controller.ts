import { Request, Response } from 'express';
import { prisma } from '../db';
import { SubscriptionStatus, Role } from '@prisma/client';
import { sendWelcomeMessage } from '../services/n8n.service';
import { logAuditEvent } from '../utils/audit.logger';
import crypto from 'crypto';
import { handleControllerError } from '../utils/http';
import { resolveModulesConfig } from '../utils/modules-config';

// GET /users/me/context
export const getMyContext = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const userId = req.user?.id;

    if (!gymId || !userId) {
      res.status(401).json({ error: 'Unauthorized: Context missing' });
      return;
    }

    const [user, gym] = await prisma.$transaction([
      prisma.user.findFirst({
        where: { id: userId, gym_id: gymId, deleted_at: null },
        select: {
          id: true,
          auth_user_id: true,
          name: true,
          phone: true,
          profile_picture_url: true,
          role: true,
        },
      }),
      prisma.gym.findUnique({
        where: { id: gymId },
        select: {
          id: true,
          name: true,
          subscription_tier: true,
          modules_config: true,
        },
      }),
    ]);

    if (!user || !gym) {
      res.status(404).json({ error: 'User or gym context not found.' });
      return;
    }

    res.status(200).json({
      user,
      gym: {
        id: gym.id,
        name: gym.name,
        subscription_tier: gym.subscription_tier,
        modules_config: resolveModulesConfig(gym.modules_config, gym.subscription_tier),
      },
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getMyContext Error]', 'Failed to retrieve user context.');
  }
};

// GET /users
export const getUsers = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { page = '1', limit = '50' } = req.query;
    const take = Math.min(Number(limit) || 50, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { gym_id: gymId },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          current_streak: true,
          last_visit_at: true,
          created_at: true,
          subscriptions: {
            orderBy: { created_at: 'desc' },
            take: 1,
            select: { status: true, expires_at: true },
          },
        },
        orderBy: { created_at: 'desc' },
        take,
        skip,
      }),
      prisma.user.count({ where: { gym_id: gymId } }),
    ]);

    res.status(200).json({ data: users, meta: { total, page: Number(page), limit: take } });
  } catch (error) {
    handleControllerError(req, res, error, '[getUsers Error]', 'Failed to retrieve users.');
  }
};

// GET /users/search?q=...
export const searchUsers = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) {
      res.status(400).json({ error: 'Query must have at least 2 characters.' });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        gym_id: gymId,
        deleted_at: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        profile_picture_url: true,
        role: true,
        current_streak: true,
        last_visit_at: true,
      },
      take: 25,
      orderBy: { created_at: 'desc' },
    });

    res.status(200).json({ data: users });
  } catch (error) {
    handleControllerError(req, res, error, '[searchUsers Error]', 'Failed to search users.');
  }
};

const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

// POST /users
export const createUser = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { name, phone, pin: pinFromBody, role, auth_user_id } = req.body;

    if (!phone) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    // Use provided PIN or auto-generate a secure 4-digit one
    const pin = pinFromBody ?? generatePin();
    // hash the pin before storing
    const pinHash = crypto.createHash('sha256').update(String(pin)).digest('hex');

    // Calculate initial expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          auth_user_id: auth_user_id ?? null,
          gym_id: gymId,
          name: name ?? null,
          phone,
          pin_hash: pinHash,
          role: (role && Object.values(Role).includes(role)) ? role : Role.MEMBER,
        },
      });

      // 2. Create Active Subscription
      const subscription = await tx.subscription.create({
        data: {
          gym_id: gymId,
          user_id: user.id,
          status: SubscriptionStatus.ACTIVE,
          expires_at: expiresAt,
        },
      });

      return { user, subscription };
    });

    // Fire and forget (Execute in background, no await)
    // Generating a basic payload for the QR, e.g. the user ID or a signed token
    const qrPayload = `GYM_QR_${result.user.id}`;
    sendWelcomeMessage(gymId, phone, pin, qrPayload).catch((err) => {
      req.log?.error({ err }, '[createUser WelcomeWebhook Error]');
    });

    res.status(201).json({
      id: result.user.id,
      message: 'Usuario creado satisfactoriamente.',
      assigned_pin: pinFromBody ? undefined : pin, // Only expose auto-generated PINs
    });
  } catch (error) {
    handleControllerError(req, res, error, '[createUser Error]', 'Failed to create user');
  }
};

// PATCH /users/:id/renew
export const renewSubscription = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string; // User ID

    // Find current subscription with STRICT gym_id filter
    const currentSub = await prisma.subscription.findFirst({
      where: {
        user_id: id,
        gym_id: gymId,
      },
    });

    if (!currentSub) {
      res.status(404).json({ error: 'Subscription not found for this gym' });
      return;
    }

    // Add 30 days to the current expiration date (if active) or from today (if expired)
    const now = new Date();
    const baseDate = currentSub.expires_at > now ? currentSub.expires_at : now;

    const newExpiresAt = new Date(baseDate);
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    const updatedSub = await prisma.subscription.update({
      where: {
        id: currentSub.id,
      },
      data: {
        status: SubscriptionStatus.ACTIVE,
        expires_at: newExpiresAt,
      },
    });

    // AuditLog: track every renewal for financial reconciliation
    const actorId = req.user?.id ?? id;
    await logAuditEvent(gymId, actorId, 'SUBSCRIPTION_RENEWED', {
      target_user_id: id,
      new_expires_at: newExpiresAt.toISOString(),
    });

    res.status(200).json({
      message: 'Subscription renewed successfully.',
      subscription: updatedSub,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[renewSubscription Error]', 'Failed to renew subscription');
  }
};

// PATCH /users/:id
export const updateUser = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;
    const { name, phone, profile_picture_url } = req.body;

    // Verify the user belongs to this gym (Multitenancy guard)
    const existing = await prisma.user.findFirst({
      where: { id: id as string, gym_id: gymId, deleted_at: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'User not found in this gym.' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: id as string },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(profile_picture_url !== undefined && { profile_picture_url }),
      },
      select: { id: true, name: true, phone: true, profile_picture_url: true, role: true, updated_at: true },
    });

    await logAuditEvent(gymId, req.user?.id ?? id, 'USER_UPDATED', {
      target_user_id: id,
      changes: { name, phone, profile_picture_url },
    });

    res.status(200).json({ message: 'User updated.', user: updatedUser });
  } catch (error) {
    handleControllerError(req, res, error, '[updateUser Error]', 'Failed to update user.');
  }
};

// DELETE /users/:id — SOFT DELETE
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;

    const existing = await prisma.user.findFirst({
      where: { id: id as string, gym_id: gymId, deleted_at: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'User not found or already deleted.' });
      return;
    }

    // SOFT DELETE — NUNCA usar prisma.user.delete()
    await prisma.user.update({
      where: { id: id as string },
      data: { deleted_at: new Date() },
    });

    await logAuditEvent(gymId, req.user?.id ?? id, 'USER_SOFT_DELETED', {
      target_user_id: id,
    });

    res.status(200).json({ message: 'User soft-deleted successfully.' });
  } catch (error) {
    handleControllerError(req, res, error, '[deleteUser Error]', 'Failed to delete user.');
  }
};

// PATCH /users/:id/freeze
export const freezeSubscription = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string; // User ID

    const sub = await prisma.subscription.findFirst({
      where: { user_id: id as string, gym_id: gymId, status: SubscriptionStatus.ACTIVE },
    });

    if (!sub) {
      res.status(404).json({ error: 'Active subscription not found for this user.' });
      return;
    }

    const now = new Date();
    const msLeft = sub.expires_at.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

    const frozenSub = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.FROZEN,
        frozen_days_left: daysLeft,
      },
    });

    await logAuditEvent(gymId, req.user?.id ?? id, 'SUBSCRIPTION_FROZEN', {
      target_user_id: id,
      days_frozen: daysLeft,
    });

    res.status(200).json({
      message: `Subscription frozen. ${daysLeft} days saved.`,
      subscription: frozenSub,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[freezeSubscription Error]', 'Failed to freeze subscription.');
  }
};

// PATCH /users/:id/unfreeze
export const unfreezeSubscription = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string; // User ID

    const sub = await prisma.subscription.findFirst({
      where: { user_id: id as string, gym_id: gymId, status: SubscriptionStatus.FROZEN },
    });

    if (!sub) {
      res.status(404).json({ error: 'Frozen subscription not found for this user.' });
      return;
    }

    const daysLeft = sub.frozen_days_left ?? 0;
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + daysLeft);

    const activatedSub = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        expires_at: newExpiresAt,
        frozen_days_left: null,
      },
    });

    await logAuditEvent(gymId, req.user?.id ?? id, 'SUBSCRIPTION_UNFROZEN', {
      target_user_id: id,
      days_restored: daysLeft,
      new_expires_at: newExpiresAt.toISOString(),
    });

    res.status(200).json({
      message: `Subscription reactivated. Expires on ${newExpiresAt.toISOString().split('T')[0]}.`,
      subscription: activatedSub,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[unfreezeSubscription Error]', 'Failed to unfreeze subscription.');
  }
};

// PATCH /users/:id/cancel-subscription
export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;
    const { reason } = req.body;

    const activeOrFrozen = await prisma.subscription.findFirst({
      where: {
        user_id: id,
        gym_id: gymId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.FROZEN] },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!activeOrFrozen) {
      res.status(404).json({ error: 'Active or frozen subscription not found for this user.' });
      return;
    }

    const cancelled = await prisma.subscription.update({
      where: { id: activeOrFrozen.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        expires_at: new Date(),
        frozen_days_left: null,
      },
    });

    await logAuditEvent(gymId, req.user?.id ?? id, 'SUBSCRIPTION_CANCELED', {
      target_user_id: id,
      reason: reason ?? 'No reason provided',
      subscription_id: cancelled.id,
    });

    res.status(200).json({
      message: 'Subscription cancelled successfully.',
      subscription: cancelled,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[cancelSubscription Error]', 'Failed to cancel subscription.');
  }
};

// GET /users/:id/data-export
export const exportUserData = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;

    const user = await prisma.user.findFirst({
      where: { id, gym_id: gymId },
      select: {
        id: true,
        auth_user_id: true,
        gym_id: true,
        name: true,
        phone: true,
        profile_picture_url: true,
        role: true,
        current_streak: true,
        last_visit_at: true,
        deleted_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found in this gym.' });
      return;
    }

    const [subscriptions, visits, bookings] = await prisma.$transaction([
      prisma.subscription.findMany({
        where: { user_id: id, gym_id: gymId },
        orderBy: { created_at: 'desc' },
      }),
      prisma.visit.findMany({
        where: { user_id: id, gym_id: gymId },
        orderBy: { check_in_time: 'desc' },
      }),
      prisma.classBooking.findMany({
        where: { user_id: id, gym_id: gymId },
        include: {
          class: {
            select: {
              id: true,
              name: true,
              day_of_week: true,
              start_time: true,
              end_time: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    await logAuditEvent(gymId, req.user?.id ?? id, 'USER_DATA_EXPORTED', {
      target_user_id: id,
      subscriptions: subscriptions.length,
      visits: visits.length,
      bookings: bookings.length,
    });

    res.status(200).json({
      generated_at: new Date().toISOString(),
      user,
      subscriptions,
      visits,
      bookings,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[exportUserData Error]', 'Failed to export user data.');
  }
};

// POST /users/:id/anonymize
export const anonymizeUserData = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;
    const existing = await prisma.user.findFirst({
      where: { id, gym_id: gymId },
      select: { id: true, deleted_at: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'User not found in this gym.' });
      return;
    }

    const now = new Date();
    const anonymizedPhone = `anon-${id.slice(0, 8)}-${now.getTime()}`;

    await prisma.$transaction([
      prisma.subscription.updateMany({
        where: {
          user_id: id,
          gym_id: gymId,
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.FROZEN] },
        },
        data: {
          status: SubscriptionStatus.CANCELED,
          expires_at: now,
          frozen_days_left: null,
        },
      }),
      prisma.user.update({
        where: { id },
        data: {
          auth_user_id: null,
          name: null,
          phone: anonymizedPhone,
          profile_picture_url: null,
          pin_hash: null,
          deleted_at: existing.deleted_at ?? now,
        },
      }),
    ]);

    await logAuditEvent(gymId, req.user?.id ?? id, 'USER_DATA_ANONYMIZED', {
      target_user_id: id,
      anonymized_phone: anonymizedPhone,
    });

    res.status(200).json({
      message: 'User data anonymized and active subscriptions cancelled.',
      user_id: id,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[anonymizeUserData Error]', 'Failed to anonymize user data.');
  }
};
