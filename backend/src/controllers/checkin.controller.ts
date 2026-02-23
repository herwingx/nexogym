import { Request, Response } from 'express';
import { prisma } from '../db';
import { SubscriptionStatus, AccessMethod, AccessType, Role } from '@prisma/client';
import { sendRewardMessage } from '../services/n8n.service';
import { logAuditEvent } from '../utils/audit.logger';

export const processCheckin = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    // 1. Validate Active Subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        user_id: userId,
        gym_id: gymId,
        status: SubscriptionStatus.ACTIVE,
        expires_at: {
          gt: new Date(), // must not be expired
        },
      },
    });

    if (!subscription) {
      res.status(403).json({ error: 'Forbidden: No active subscription found for this user.' });
      return;
    }

    // 2. Fetch User and Gym for Gamification
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!user || !gym) {
      res.status(404).json({ error: 'User or Gym not found.' });
      return;
    }

    // 3. Gamification Logic (Streak calculation)
    const now = new Date();
    // Normalize to start of day for accurate day-diff calculation
    const todayStr = now.toISOString().split('T')[0];
    const todayStart = new Date(todayStr);

    let newStreak = user.current_streak;

    if (user.last_visit_at) {
      const lastVisitStr = user.last_visit_at.toISOString().split('T')[0];
      const lastVisitStart = new Date(lastVisitStr);

      const diffTime = Math.abs(todayStart.getTime() - lastVisitStart.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Visited exactly yesterday -> +1 streak
        newStreak += 1;
      } else if (diffDays > 1) {
        // Missed a day -> Reset
        newStreak = 1;
      }
      // If diffDays === 0, they visited today already, streak stays the same
    } else {
      // First visit ever
      newStreak = 1;
    }

    // 4. Evaluate Reward
    let rewardUnlocked = false;
    let rewardMessage = null;

    if (gym.rewards_config && typeof gym.rewards_config === 'object') {
      const config = gym.rewards_config as Record<string, any>;
      if (config[newStreak.toString()]) {
        rewardUnlocked = true;
        rewardMessage = config[newStreak.toString()];
      }
    }

    // 5. Transaction: Update User and Save Visit
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          current_streak: newStreak,
          last_visit_at: now,
        },
      }),
      prisma.visit.create({
        data: {
          gym_id: gymId,
          user_id: userId,
          check_in_time: now,
          access_method: AccessMethod.MANUAL, // Sprint B9 will use BIOMETRIC
          access_type: AccessType.REGULAR,
        },
      }),
    ]);

    // Fire-and-forget reward webhook if prize unlocked
    if (rewardUnlocked && user.phone) {
      sendRewardMessage(user.phone, String(rewardMessage), newStreak).catch(console.error);
    }

    res.status(200).json({
      success: true,
      newStreak,
      rewardUnlocked,
      message: rewardUnlocked ? `¡Premio desbloqueado: ${rewardMessage}!` : '¡De vuelta al ruedo!',
    });
  } catch (error) {
    console.error('[processCheckin Error]:', error);
    res.status(500).json({ error: 'Failed to process check-in.' });
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
    console.error('[processCourtesyAccess Error]:', error);
    res.status(500).json({ error: 'Failed to process courtesy access.' });
  }
};
