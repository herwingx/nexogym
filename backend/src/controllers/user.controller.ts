import { Request, Response } from 'express';
import { prisma } from '../db';
import { SubscriptionStatus, Role } from '@prisma/client';
import { sendWelcomeMessage } from '../services/n8n.service';
import { logAuditEvent } from '../utils/audit.logger';
import crypto from 'crypto';

// GET /users
export const getUsers = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const users = await prisma.user.findMany({
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
    });

    res.status(200).json({ data: users });
  } catch (error) {
    console.error('[getUsers Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve users.' });
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

    const { name, phone, pin: pinFromBody, role } = req.body;

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
    sendWelcomeMessage(phone, pin, qrPayload).catch(console.error);

    res.status(201).json({
      id: result.user.id,
      message: 'Usuario creado satisfactoriamente.',
      assigned_pin: pinFromBody ? undefined : pin, // Only expose auto-generated PINs
    });
  } catch (error) {
    console.error('[createUser Error]:', error);
    res.status(500).json({ error: 'Failed to create user' });
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
    console.error('[renewSubscription Error]:', error);
    res.status(500).json({ error: 'Failed to renew subscription' });
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
    const { name, phone } = req.body;

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
      },
      select: { id: true, name: true, phone: true, role: true, updated_at: true },
    });

    await logAuditEvent(gymId, req.user?.id ?? id, 'USER_UPDATED', {
      target_user_id: id,
      changes: { name, phone },
    });

    res.status(200).json({ message: 'User updated.', user: updatedUser });
  } catch (error) {
    console.error('[updateUser Error]:', error);
    res.status(500).json({ error: 'Failed to update user.' });
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
    console.error('[deleteUser Error]:', error);
    res.status(500).json({ error: 'Failed to delete user.' });
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
    console.error('[freezeSubscription Error]:', error);
    res.status(500).json({ error: 'Failed to freeze subscription.' });
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
    console.error('[unfreezeSubscription Error]:', error);
    res.status(500).json({ error: 'Failed to unfreeze subscription.' });
  }
};
