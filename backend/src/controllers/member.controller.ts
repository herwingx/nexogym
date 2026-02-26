import { Request, Response } from 'express';
import { prisma } from '../db';
import { SubscriptionStatus } from '@prisma/client';
import { handleControllerError } from '../utils/http';
import { sendQrResend } from '../services/n8n.service';
import { parseRewardsConfig, getNextRewardMilestone } from '../utils/rewards-config';

const QR_PAYLOAD_PREFIX = 'GYM_QR_';

/**
 * GET /members/me
 * Perfil del socio para el portal: membresía, racha, visitas, próximo premio.
 */
export const getMemberProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const gymId = req.gymId;
    if (!userId || !gymId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, gym_id: gymId, deleted_at: null },
      select: {
        id: true,
        qr_token: true,
        name: true,
        profile_picture_url: true,
        current_streak: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const [subscription, totalVisits, gym] = await Promise.all([
      prisma.subscription.findFirst({
        where: { user_id: userId, gym_id: gymId },
        orderBy: { expires_at: 'desc' },
      }),
      prisma.visit.count({ where: { user_id: userId, gym_id: gymId } }),
      prisma.gym.findUnique({
        where: { id: gymId },
        select: { rewards_config: true },
      }),
    ]);

    const status = subscription?.status ?? null;
    let membership_status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'PENDING_PAYMENT' = 'EXPIRED';
    if (status === SubscriptionStatus.ACTIVE) membership_status = 'ACTIVE';
    else if (status === SubscriptionStatus.FROZEN) membership_status = 'SUSPENDED';
    else if (status === SubscriptionStatus.PENDING_PAYMENT) membership_status = 'PENDING_PAYMENT';
    else if (status === SubscriptionStatus.EXPIRED || status === SubscriptionStatus.CANCELED)
      membership_status = 'EXPIRED';

    const parsed = parseRewardsConfig(gym?.rewards_config ?? null);
    let next_reward: { label: string; visits_required: number; visits_progress: number } | null = null;
    const nextMilestone = getNextRewardMilestone(parsed, user.current_streak);
    if (nextMilestone) {
      next_reward = {
        label: nextMilestone.label,
        visits_required: nextMilestone.days,
        visits_progress: user.current_streak,
      };
    }

    const email = (req.user as { email?: string })?.email ?? null;

    const qr_payload = `${QR_PAYLOAD_PREFIX}${user.qr_token ?? user.id}`;

    res.status(200).json({
      id: user.id,
      qr_payload,
      name: user.name ?? '',
      email: email ?? '',
      profile_picture_url: user.profile_picture_url,
      membership_status,
      membership_type: null,
      expiry_date: subscription?.expires_at?.toISOString().split('T')[0] ?? null,
      current_streak: user.current_streak,
      best_streak: user.current_streak,
      total_visits: totalVisits,
      next_reward,
      streak_rewards: parsed.streakRewards,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getMemberProfile Error]', 'Failed to load member profile.');
  }
};

/**
 * GET /members/me/history?page=1&pageSize=10
 * Historial de visitas del socio (check-ins).
 */
export const getMemberHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const gymId = req.gymId;
    if (!userId || !gymId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const skip = (page - 1) * pageSize;

    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where: { user_id: userId, gym_id: gymId },
        orderBy: { check_in_time: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.visit.count({ where: { user_id: userId, gym_id: gymId } }),
    ]);

    const data = visits.map((v) => ({
      id: v.id,
      checked_in_at: v.check_in_time.toISOString(),
      access_method: v.access_method,
      streak_at_checkin: null as number | null,
    }));

    res.status(200).json({
      data,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getMemberHistory Error]', 'Failed to load visit history.');
  }
};

/**
 * POST /members/me/send-qr
 * Reenvía el QR de acceso del socio por WhatsApp (mismo código estable). Ej.: borró el chat, lo perdió.
 */
export const requestQrResend = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const gymId = req.gymId;
    if (!userId || !gymId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, gym_id: gymId, deleted_at: null },
      select: { id: true, qr_token: true, phone: true },
    });

    if (!user) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const phone = user.phone?.trim();
    if (!phone) {
      res.status(400).json({
        error: 'No tenemos un número de WhatsApp registrado. Pide en recepción que actualicen tu teléfono.',
      });
      return;
    }

    const qrPayload = `${QR_PAYLOAD_PREFIX}${user.qr_token ?? user.id}`;
    await sendQrResend(gymId, phone, qrPayload);

    res.status(200).json({
      message: 'Si el gym tiene WhatsApp configurado, recibirás tu código de acceso en unos segundos.',
    });
  } catch (error) {
    handleControllerError(req, res, error, '[requestQrResend Error]', 'Failed to send QR.');
  }
};

/**
 * GET /members/leaderboard?limit=20
 * Tabla de racha: socios ordenados por current_streak DESC, empate por last_visit_at DESC (más reciente primero).
 */
export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    const users = await prisma.user.findMany({
      where: {
        gym_id: gymId,
        role: 'MEMBER',
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        profile_picture_url: true,
        current_streak: true,
        last_visit_at: true,
      },
      orderBy: [{ current_streak: 'desc' }, { last_visit_at: 'desc' }],
      take: limit,
    });

    res.status(200).json({
      data: users.map((u, idx) => ({
        rank: idx + 1,
        id: u.id,
        name: u.name ?? '—',
        profile_picture_url: u.profile_picture_url,
        current_streak: u.current_streak,
      })),
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getLeaderboard Error]', 'Failed to load leaderboard.');
  }
};
