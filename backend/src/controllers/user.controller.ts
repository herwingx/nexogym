import { Request, Response } from 'express';
import { prisma } from '../db';
import { SubscriptionStatus, Role, SubscriptionTier } from '@prisma/client';
import { sendWelcomeMessage, sendQrResend } from '../services/n8n.service';
import { logAuditEvent } from '../utils/audit.logger';
import crypto from 'crypto';
import { handleControllerError } from '../utils/http';
import { resolveModulesConfig } from '../utils/modules-config';

// GET /users/me/context
// Tenant Guard (capa 1): al establecer sesión (login/restore), rechaza si gym no está ACTIVE. SUPERADMIN exento.
export const getMyContext = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const userId = req.user?.id;
    const userRole = req.userRole;

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
          status: true,
          deleted_at: true,
          subscription_tier: true,
          modules_config: true,
          theme_colors: true,
          logo_url: true,
        },
      }),
    ]);

    if (!user || !gym) {
      res.status(404).json({ error: 'User or gym context not found.' });
      return;
    }

    // Tenant Guard: if not SUPERADMIN, reject if gym is suspended or cancelled
    if (userRole !== Role.SUPERADMIN && (gym.deleted_at != null || gym.status !== 'ACTIVE')) {
      res.status(403).json({ error: 'El acceso a este gimnasio está suspendido.' });
      return;
    }

    let modulesConfig: ReturnType<typeof resolveModulesConfig>;
    try {
      const tier = gym.subscription_tier ?? SubscriptionTier.BASIC;
      modulesConfig = resolveModulesConfig(gym.modules_config, tier);
    } catch {
      modulesConfig = resolveModulesConfig(null, SubscriptionTier.BASIC);
    }

    const themeColors = gym.theme_colors as Record<string, string> | null | undefined;
    res.status(200).json({
      user,
      gym: {
        id: gym.id,
        name: gym.name,
        subscription_tier: gym.subscription_tier,
        modules_config: modulesConfig,
        theme_colors: themeColors ?? undefined,
        logo_url: gym.logo_url ?? undefined,
      },
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getMyContext Error]', 'Failed to retrieve user context.');
  }
};

// GET /users — query: page, limit, role_not (e.g. role_not=MEMBER para listar solo staff)
export const getUsers = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { page = '1', limit = '50', role_not: roleNot } = req.query;
    const take = Math.min(Number(limit) || 50, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: { gym_id: string; role?: { not: Role } } = { gym_id: gymId };
    if (roleNot === 'MEMBER' || String(roleNot).toUpperCase() === 'MEMBER') {
      where.role = { not: Role.MEMBER };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          deleted_at: true,
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
      prisma.user.count({ where }),
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

    const { name, phone, pin: pinFromBody, role, auth_user_id, profile_picture_url, birth_date: birthDateRaw } = req.body;

    if (!phone) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    const birthDate = birthDateRaw != null && birthDateRaw !== ''
      ? (typeof birthDateRaw === 'string' ? new Date(birthDateRaw) : birthDateRaw)
      : undefined;
    const birthDateOnly = birthDate && !Number.isNaN(birthDate.getTime())
      ? new Date(birthDate.toISOString().split('T')[0] + 'T00:00:00.000Z')
      : undefined;

    // Use provided PIN or auto-generate a secure 4-digit one
    const pin = pinFromBody ?? generatePin();
    // hash the pin before storing
    const pinHash = crypto.createHash('sha256').update(String(pin)).digest('hex');
    const qrToken = crypto.randomBytes(16).toString('hex');

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
          qr_token: qrToken,
          role: (role && Object.values(Role).includes(role)) ? role : Role.MEMBER,
          ...(profile_picture_url != null && profile_picture_url !== '' && { profile_picture_url: String(profile_picture_url) }),
          ...(birthDateOnly != null && { birth_date: birthDateOnly }),
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
    const qrPayload = `GYM_QR_${result.user.qr_token ?? result.user.id}`;
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

    const now = new Date();
    // Cuando se va y regresa (vencido o congelado): nuevo periodo desde el día que paga (hoy).
    // Solo si sigue ACTIVO y con fecha vigente: se extiende desde su expires_at actual.
    const isStillActiveWithTimeLeft =
      currentSub.status === SubscriptionStatus.ACTIVE && currentSub.expires_at > now;
    const baseDate = isStillActiveWithTimeLeft ? currentSub.expires_at : now;

    const newExpiresAt = new Date(baseDate);
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    const updatedSub = await prisma.subscription.update({
      where: { id: currentSub.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        expires_at: newExpiresAt,
        // Vuelve de FROZEN/EXPIRED: limpiamos días congelados (nuevo periodo desde hoy)
        ...((currentSub.status === SubscriptionStatus.FROZEN || !isStillActiveWithTimeLeft) && {
          frozen_days_left: null,
        }),
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
    const { name, phone, profile_picture_url, birth_date: birthDateRaw } = req.body;

    // Verify the user belongs to this gym (Multitenancy guard)
    const existing = await prisma.user.findFirst({
      where: { id: id as string, gym_id: gymId, deleted_at: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'User not found in this gym.' });
      return;
    }

    const birthDateOnly =
      birthDateRaw !== undefined
        ? (birthDateRaw === null || birthDateRaw === ''
          ? null
          : (() => {
              const d = typeof birthDateRaw === 'string' ? new Date(birthDateRaw) : birthDateRaw;
              return !Number.isNaN(d.getTime()) ? new Date(d.toISOString().split('T')[0] + 'T00:00:00.000Z') : undefined;
            })())
        : undefined;

    const updatedUser = await prisma.user.update({
      where: { id: id as string },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(profile_picture_url !== undefined && { profile_picture_url }),
        ...(birthDateOnly !== undefined && { birth_date: birthDateOnly }),
      },
      select: { id: true, name: true, phone: true, profile_picture_url: true, role: true, birth_date: true, updated_at: true },
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

// POST /users/:id/send-qr — Reenviar QR de acceso por WhatsApp (staff)
export const sendQrToMember = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;

    const user = await prisma.user.findFirst({
      where: { id, gym_id: gymId, deleted_at: null },
      select: { id: true, qr_token: true, phone: true, name: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const phone = user.phone?.trim();
    if (!phone) {
      res.status(400).json({
        error: 'El socio no tiene número de teléfono registrado. Actualiza su ficha para poder enviar el QR por WhatsApp.',
      });
      return;
    }

    const qrPayload = `GYM_QR_${user.qr_token ?? user.id}`;
    await sendQrResend(gymId, phone, qrPayload);

    await logAuditEvent(gymId, req.user?.id ?? '', 'QR_RESENT', { target_user_id: id });

    res.status(200).json({
      message: 'Si el gym tiene WhatsApp configurado, el socio recibirá su código de acceso en unos segundos.',
    });
  } catch (error) {
    handleControllerError(req, res, error, '[sendQrToMember Error]', 'Failed to send QR.');
  }
};

// POST /users/:id/regenerate-qr — Regenerar QR del socio (Admin only). Invalida el anterior.
export const regenerateQr = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;
    const sendToWhatsApp = req.body?.sendToWhatsApp === true;

    const user = await prisma.user.findFirst({
      where: { id, gym_id: gymId, deleted_at: null },
      select: { id: true, phone: true, name: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const newToken = crypto.randomBytes(16).toString('hex');
    await prisma.user.update({
      where: { id },
      data: { qr_token: newToken },
    });

    const qrPayload = `GYM_QR_${newToken}`;

    if (sendToWhatsApp && user.phone?.trim()) {
      await sendQrResend(gymId, user.phone.trim(), qrPayload);
    }

    await logAuditEvent(gymId, req.user?.id ?? '', 'QR_REGENERATED', {
      target_user_id: id,
      send_to_whatsapp: sendToWhatsApp,
    });

    res.status(200).json({
      message: sendToWhatsApp
        ? 'QR regenerado. El socio recibirá el nuevo código por WhatsApp en unos segundos.'
        : 'QR regenerado. El código anterior ya no es válido.',
    });
  } catch (error) {
    handleControllerError(req, res, error, '[regenerateQr Error]', 'Failed to regenerate QR.');
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

/** Sincroniza estado: ACTIVE con expires_at ya pasada → EXPIRED (por gym). Para cron diario o ejecución manual. */
export const syncExpiredSubscriptions = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const now = new Date();
    const result = await prisma.subscription.updateMany({
      where: {
        gym_id: gymId,
        status: SubscriptionStatus.ACTIVE,
        expires_at: { lt: now },
      },
      data: { status: SubscriptionStatus.EXPIRED },
    });

    if (result.count > 0) {
      await logAuditEvent(gymId, req.user?.id ?? 'system', 'SUBSCRIPTIONS_SYNC_EXPIRED', {
        count: result.count,
        reason: 'expires_at < now',
      });
    }

    res.status(200).json({
      message: result.count > 0 ? `${result.count} subscription(s) marked as EXPIRED.` : 'No subscriptions to sync.',
      count: result.count,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[syncExpiredSubscriptions Error]', 'Failed to sync expired subscriptions.');
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
