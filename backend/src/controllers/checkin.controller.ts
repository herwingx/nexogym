import { Request, Response } from 'express';
import { prisma } from '../db';
import { SubscriptionStatus, AccessMethod, AccessType, Role } from '@prisma/client';
import { sendRewardMessage } from '../services/n8n.service';
import { logAuditEvent } from '../utils/audit.logger';
import { checkinSchema } from '../schemas/checkin.schema';
import { handleControllerError } from '../utils/http';
import { resolveModulesConfig } from '../utils/modules-config';

export const processCheckin = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    // 0. Zod Validation (acepta userId o code del QR)
    const validation = checkinSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    let userId = validation.data.userId;
    if (!userId && validation.data.code) {
      const payload = validation.data.code.startsWith('GYM_QR_')
        ? validation.data.code.slice(7).trim()
        : validation.data.code.trim();
      const byToken = await prisma.user.findFirst({
        where: { qr_token: payload, gym_id: gymId },
        select: { id: true },
      });
      if (byToken) userId = byToken.id;
    }
    const accessMethod = validation.data.accessMethod ?? AccessMethod.MANUAL;

    if (!userId) {
      res.status(400).json({ error: 'Código QR no válido.' });
      return;
    }

    // 1. Validate Active Subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        user_id: userId,
        gym_id: gymId,
        status: SubscriptionStatus.ACTIVE,
        expires_at: {
          gt: new Date(),
        },
      },
    });

    if (!subscription) {
      const debtorUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, profile_picture_url: true },
      });
      res.status(403).json({
        error: 'Forbidden: No active subscription found.',
        code: 'NO_ACTIVE_SUBSCRIPTION',
        user_id: userId,
        user: debtorUser
          ? { name: debtorUser.name, profile_picture_url: debtorUser.profile_picture_url }
          : undefined,
      });
      return;
    }

    // --- NEW: Time Restriction Logic ---
    if (subscription.allowed_start_time && subscription.allowed_end_time) {
      const now = new Date();
      const currentTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now); // "HH:mm" en hora local del gimnasio

      if (currentTime < subscription.allowed_start_time || currentTime > subscription.allowed_end_time) {
        res.status(403).json({ 
          error: `Access Denied: Your plan only allows entry between ${subscription.allowed_start_time} and ${subscription.allowed_end_time}.` 
        });
        return;
      }
    }

    // 2. Anti-passback 2h: permite múltiples visitas por día si han pasado ≥2h
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        profile_picture_url: true,
        current_streak: true,
        last_visit_at: true,
        last_checkin_date: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const now = new Date();
    const ANTI_PASSBACK_HOURS = 2;
    if (user.last_visit_at) {
      const hoursSinceLastVisit = (now.getTime() - user.last_visit_at.getTime()) / 3600000;
      if (hoursSinceLastVisit < ANTI_PASSBACK_HOURS) {
        res.status(403).json({ error: 'Anti-Passback: Este código ya fue utilizado hace menos de 2 horas.' });
        return;
      }
    }

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: {
        modules_config: true,
        subscription_tier: true,
        rewards_config: true,
        last_reactivated_at: true,
      },
    });

    if (!gym) {
      res.status(404).json({ error: 'Gym not found.' });
      return;
    }

    const modulesConfig = resolveModulesConfig(
      gym.modules_config,
      gym.subscription_tier,
    );

    if (accessMethod === AccessMethod.QR && !modulesConfig.qr_access) {
      res.status(403).json({ error: 'Feature disabled for current subscription: qr_access' });
      return;
    }

    const gamificationEnabled = modulesConfig.gamification;

    // 3. Streak (solo 1 vez por día calendario): today > last_checkin_date → incrementa; mismo día → streak_updated false
    const todayStr = now.toISOString().split('T')[0];
    const todayStart = new Date(todayStr + 'T00:00:00.000Z');

    let newStreak = user.current_streak;
    let streakUpdated = false;
    let newLastCheckinDate: Date | null = user.last_checkin_date;

    if (gamificationEnabled) {
      if (!user.last_checkin_date) {
        newStreak = 1;
        streakUpdated = true;
        newLastCheckinDate = todayStart;
      } else {
        const lastStr = user.last_checkin_date.toISOString().split('T')[0];
        const lastStart = new Date(lastStr + 'T00:00:00.000Z');
        const diffTime = todayStart.getTime() - lastStart.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          streakUpdated = false;
        } else if (diffDays === 1) {
          newStreak = user.current_streak + 1;
          streakUpdated = true;
          newLastCheckinDate = todayStart;
        } else {
          // diffDays > 1: normalmente rompe racha. Excepción: Streak Freeze (gym reactivado en últimas 48h)
          const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
          const reactivatedWithin48h =
            gym.last_reactivated_at != null && gym.last_reactivated_at >= fortyEightHoursAgo;
          if (reactivatedWithin48h) {
            newStreak = user.current_streak + 1;
            streakUpdated = true;
            newLastCheckinDate = todayStart;
          } else {
            newStreak = 1;
            streakUpdated = true;
            newLastCheckinDate = todayStart;
          }
        }
      }
    }

    // 4. Evaluate Reward
    let rewardUnlocked = false;
    let rewardMessage: string | null = null;
    if (gamificationEnabled && gym.rewards_config && typeof gym.rewards_config === 'object') {
      const config = gym.rewards_config as Record<string, string>;
      if (config[newStreak.toString()]) {
        rewardUnlocked = true;
        rewardMessage = config[newStreak.toString()];
      }
    }

    // 5. Transaction: Visit + User (last_visit_at siempre; last_checkin_date y current_streak si gamificación)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          last_visit_at: now,
          ...(gamificationEnabled && {
            current_streak: newStreak,
            last_checkin_date: newLastCheckinDate,
          }),
        },
      }),
      prisma.visit.create({
        data: {
          gym_id: gymId,
          user_id: userId,
          check_in_time: now,
          access_method: accessMethod,
          access_type: AccessType.REGULAR,
        },
      }),
    ]);

    if (rewardUnlocked && user.phone && rewardMessage) {
      sendRewardMessage(gymId, user.phone, rewardMessage, newStreak, accessMethod).catch((err) => {
        req.log?.error({ err }, '[processCheckin RewardWebhook Error]');
      });
    }

    res.status(200).json({
      success: true,
      newStreak,
      streak_updated: streakUpdated,
      rewardUnlocked,
      user: {
        name: user.name,
        profile_picture_url: user.profile_picture_url,
      },
      message: rewardUnlocked ? `¡Premio desbloqueado: ${rewardMessage}!` : '¡Acceso registrado correctamente!',
    });
  } catch (error) {
    handleControllerError(req, res, error, '[processCheckin Error]', 'Failed to process check-in.');
  }
};

/**
 * GET /checkin/visits
 * Historial de visitas del gym (Staff). Paginado con índice compuesto (gym_id, check_in_time).
 */
export const listVisits = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where: { gym_id: gymId },
        orderBy: { check_in_time: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          user_id: true,
          check_in_time: true,
          access_method: true,
          access_type: true,
          user: { select: { name: true, phone: true } },
        },
      }),
      prisma.visit.count({ where: { gym_id: gymId } }),
    ]);

    res.status(200).json({
      data: visits.map((v) => ({
        id: v.id,
        user_id: v.user_id,
        user_name: v.user.name,
        user_phone: v.user.phone,
        check_in_time: v.check_in_time.toISOString(),
        access_method: v.access_method,
        access_type: v.access_type,
      })),
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    handleControllerError(req, res, error, '[listVisits Error]', 'Failed to list visits.');
  }
};

/**
 * POST /checkin/courtesy
 * Endpoint exclusivo para ADMIN. Permite la entrada a un usuario sin suscripción activa.
 * Casos de uso: socio olvidó cartera, cortesía especial del dueño, etc.
 * Registrado en AuditLog para prevenir abusos del recepcionista.
 */
export const processCourtesyAccess = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const actorId = req.user?.id;

    if (!gymId || !actorId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    // Enforce: only ADMIN or SUPERADMIN can authorize courtesy access
    if (req.userRole !== Role.ADMIN && req.userRole !== Role.SUPERADMIN) {
      res.status(403).json({ error: 'Forbidden: Only admins can authorize courtesy access.' });
      return;
    }

    const { userId, reason } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required.' });
      return;
    }

    // Verify the target user belongs to this gym
    const user = await prisma.user.findFirst({
      where: { id: userId, gym_id: gymId, deleted_at: null },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found in this gym.' });
      return;
    }

    const now = new Date();

    // Register the courtesy visit
    const visit = await prisma.visit.create({
      data: {
        gym_id: gymId,
        user_id: userId,
        check_in_time: now,
        access_method: AccessMethod.MANUAL,
        access_type: AccessType.COURTESY,
      },
    });

    // AuditLog: CRÍTICO — registrar quién autorizó la entrada para anti-robo
    await logAuditEvent(gymId, actorId, 'COURTESY_ACCESS_GRANTED', {
      target_user_id: userId,
      target_user_name: user.name,
      reason: reason ?? 'No reason provided',
      visit_id: visit.id,
    });

    res.status(200).json({
      success: true,
      message: `Courtesy access granted to ${user.name ?? userId}.`,
      visit_id: visit.id,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[processCourtesyAccess Error]', 'Failed to process courtesy access.');
  }
};
