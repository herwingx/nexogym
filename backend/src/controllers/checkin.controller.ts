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

    // 0. Zod Validation
    const validation = checkinSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const { userId, accessMethod = AccessMethod.MANUAL } = validation.data;

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
      res.status(403).json({ error: 'Forbidden: No active subscription found.' });
      return;
    }

    // --- NEW: Time Restriction Logic ---
    if (subscription.allowed_start_time && subscription.allowed_end_time) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      if (currentTime < subscription.allowed_start_time || currentTime > subscription.allowed_end_time) {
        res.status(403).json({ 
          error: `Access Denied: Your plan only allows entry between ${subscription.allowed_start_time} and ${subscription.allowed_end_time}.` 
        });
        return;
      }
    }

    // 2. Fetch User and Gym for Gamification
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const now = new Date();
    if (user.last_visit_at) {
      const hoursSinceLastVisit = Math.abs(now.getTime() - user.last_visit_at.getTime()) / 3600000;
      if (hoursSinceLastVisit < 4) {
        res.status(403).json({ error: 'Anti-Passback: Este código ya fue utilizado hace menos de 4 horas.' });
        return;
      }
    }

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
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

    // 3. Gamification Logic (Streak calculation)
    const todayStr = now.toISOString().split('T')[0];
    const todayStart = new Date(todayStr);

    let newStreak = user.current_streak;

    if (gamificationEnabled) {
      if (user.last_visit_at) {
        const lastVisitStr = user.last_visit_at.toISOString().split('T')[0];
        const lastVisitStart = new Date(lastVisitStr);

        const diffTime = Math.abs(todayStart.getTime() - lastVisitStart.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          newStreak += 1;
        } else if (diffDays > 1) {
          newStreak = 1;
        }
      } else {
        newStreak = 1;
      }
    }

    // 4. Evaluate Reward
    let rewardUnlocked = false;
    let rewardMessage = null;

    if (gamificationEnabled && gym.rewards_config && typeof gym.rewards_config === 'object') {
      const config = gym.rewards_config as Record<string, any>;
      if (config[newStreak.toString()]) {
        rewardUnlocked = true;
        rewardMessage = config[newStreak.toString()];
      }
    }

    // 5. Transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          ...(gamificationEnabled && { current_streak: newStreak }),
          last_visit_at: now,
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

    if (rewardUnlocked && user.phone) {
      sendRewardMessage(gymId, user.phone, String(rewardMessage), newStreak, accessMethod).catch((err) => {
        req.log?.error({ err }, '[processCheckin RewardWebhook Error]');
      });
    }

    res.status(200).json({
      success: true,
      newStreak,
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
