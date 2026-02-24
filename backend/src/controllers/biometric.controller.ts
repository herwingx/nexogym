import { Request, Response } from 'express';
import { prisma } from '../db';
import { SubscriptionStatus, AccessMethod, AccessType } from '@prisma/client';
import { sendRewardMessage } from '../services/n8n.service';

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
      select: { rewards_config: true },
    });

    if (!gym) {
      res.status(404).json({ openDoor: false, error: 'Gym not found.' });
      return;
    }

    const now = new Date();

    // Gamification: streak calculation (mirrors processCheckin logic)
    const todayStr = now.toISOString().split('T')[0];
    const todayStart = new Date(todayStr);
    let newStreak = user.current_streak;

    if (user.last_visit_at) {
      const lastVisitStr = user.last_visit_at.toISOString().split('T')[0];
      const lastVisitStart = new Date(lastVisitStr);
      const diffDays = Math.ceil(
        Math.abs(todayStart.getTime() - lastVisitStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    let rewardUnlocked = false;
    let rewardMessage: string | null = null;

    if (gym.rewards_config && typeof gym.rewards_config === 'object') {
      const config = gym.rewards_config as Record<string, string>;
      const unlocked = config[newStreak.toString()];
      if (unlocked) {
        rewardUnlocked = true;
        rewardMessage = unlocked;
      }
    }

    // Transaction: register visit + update streak
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
        data: { current_streak: newStreak, last_visit_at: now },
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
