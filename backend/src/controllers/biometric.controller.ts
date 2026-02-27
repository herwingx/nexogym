import { Request, Response } from 'express';
import { prisma } from '../db';
import { SubscriptionStatus, AccessMethod, AccessType } from '@prisma/client';
import { sendRewardMessage } from '../services/n8n.service';
import { parseRewardsConfig, getRewardMessageForStreak } from '../utils/rewards-config';
import { resolveModulesConfig } from '../utils/modules-config';
import { wereAllGapDaysClosed } from '../utils/opening-config';

export const biometricCheckIn = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ openDoor: false, error: 'Unauthorized: Gym context missing' });
      return;
    }

    // Assume the IoT reader sends `pin` or `fingerprintId` mapped to `pin_hash`
    const { footprint_id } = req.body;

    if (!footprint_id) {
      res.status(400).json({ openDoor: false, error: 'footprint_id is required' });
      return;
    }

    // Identify User by footprint_id (which maps to pin_hash or similar biometric abstraction)
    const user = await prisma.user.findFirst({
      where: {
        gym_id: gymId,
        pin_hash: footprint_id, // For this scope, the pin_hash doubles as the biometric abstraction identifier
      },
    });

    if (!user) {
      res.status(404).json({ openDoor: false, error: 'User not recognized by hardware' });
      return;
    }

    // Validate Active Subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        user_id: user.id,
        gym_id: gymId,
        status: SubscriptionStatus.ACTIVE,
        expires_at: {
          gt: new Date(),
        },
      },
    });

    if (!subscription) {
      // Return 200 but openDoor false for physical torniquete denial
      res.status(200).json({ openDoor: false, reason: 'Subscription Expired or Inactive' });
      return;
    }

    if (user.last_visit_at) {
      const hoursSinceLastVisit = Math.abs(new Date().getTime() - user.last_visit_at.getTime()) / 3600000;
      if (hoursSinceLastVisit < 4) {
        res.status(200).json({ openDoor: false, reason: 'Anti-Passback: ingreso bloqueado temporalmente.' });
        return;
      }
    }

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: {
        rewards_config: true,
        modules_config: true,
        subscription_tier: true,
        last_reactivated_at: true,
        opening_config: true,
      },
    });

    if (!gym) {
      res.status(404).json({ openDoor: false, error: 'Gym not found.' });
      return;
    }

    const now = new Date();
    const modulesConfig = resolveModulesConfig(gym.modules_config, gym.subscription_tier);
    const gamificationEnabled = modulesConfig.gamification;

    // Streak: misma lógica que check-in (usa last_checkin_date para consistencia con streak-reset job)
    const todayStr = now.toISOString().split('T')[0];
    const todayStart = new Date(todayStr + 'T00:00:00.000Z');
    let newStreak = user.current_streak;
    let newLastCheckinDate: Date | null = user.last_checkin_date;

    if (gamificationEnabled) {
      if (!user.last_checkin_date) {
        newStreak = 1;
        newLastCheckinDate = todayStart;
      } else {
        const lastStr = user.last_checkin_date.toISOString().split('T')[0];
        const lastStart = new Date(lastStr + 'T00:00:00.000Z');
        const diffTime = todayStart.getTime() - lastStart.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Mismo día: no incrementa racha
          newLastCheckinDate = user.last_checkin_date;
        } else if (diffDays === 1) {
          newStreak = user.current_streak + 1;
          newLastCheckinDate = todayStart;
        } else {
          // diffDays > 1: excepciones (gym reactivado, streak_freeze_until, días cerrados)
          const STREAK_FREEZE_DAYS_GYM = 7;
          const gymReactivationCutoff = new Date(
            now.getTime() - STREAK_FREEZE_DAYS_GYM * 24 * 60 * 60 * 1000
          );
          const reactivatedWithinFreezeWindow =
            gym.last_reactivated_at != null && gym.last_reactivated_at >= gymReactivationCutoff;
          const withinExpiryFreeze =
            user.streak_freeze_until != null && now <= user.streak_freeze_until;
          const allGapDaysWereClosed = wereAllGapDaysClosed(
            user.last_checkin_date,
            todayStart,
            gym.opening_config
          );
          if (reactivatedWithinFreezeWindow || withinExpiryFreeze || allGapDaysWereClosed) {
            newStreak = user.current_streak;
            newLastCheckinDate = todayStart;
          } else {
            newStreak = 1;
            newLastCheckinDate = todayStart;
          }
        }
      }
    }

    let rewardUnlocked = false;
    let rewardMessage: string | null = null;
    if (gamificationEnabled && gym.rewards_config) {
      const parsed = parseRewardsConfig(gym.rewards_config);
      rewardMessage = getRewardMessageForStreak(parsed, newStreak);
      if (rewardMessage) rewardUnlocked = true;
    }

    // Transaction: Visit + User (last_visit_at siempre; last_checkin_date y current_streak si gamificación)
    await prisma.$transaction([
      prisma.visit.create({
        data: {
          gym_id: gymId,
          user_id: user.id,
          check_in_time: now,
          access_method: AccessMethod.BIOMETRIC,
          access_type: AccessType.REGULAR,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          last_visit_at: now,
          ...(gamificationEnabled && {
            current_streak: newStreak,
            last_checkin_date: newLastCheckinDate,
          }),
        },
      }),
    ]);

    if (rewardUnlocked && user.phone) {
      sendRewardMessage(gymId, user.phone, String(rewardMessage), newStreak, AccessMethod.BIOMETRIC).catch((err) => {
        req.log?.error({ err }, '[biometricCheckIn RewardWebhook Error]');
      });
    }

    res.status(200).json({
      openDoor: true,
      message: 'Welcome!',
      newStreak,
      rewardUnlocked,
      rewardMessage,
    });
  } catch (error) {
    req.log?.error({ err: error }, '[biometricCheckIn Error]');
    res.status(500).json({ openDoor: false, error: 'Internal Server Error' });
  }
};
