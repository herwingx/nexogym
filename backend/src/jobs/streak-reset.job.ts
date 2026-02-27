/**
 * Job diario: resetea rachas de socios que no hicieron check-in "ayer".
 * Se ejecuta típicamente a las 00:05 (cron) vía POST /api/v1/webhooks/streak-reset.
 *
 * Lógica:
 * - Para cada gym con gamificación habilitada
 * - "Ayer" = hoy - 1 día (usa timezone del servidor; TODO: timezone por gym)
 * - Usuarios con last_checkin_date < ayer → current_streak = 0
 * - Excepciones (no resetear): streak_freeze_until, gym reactivado 7d, wereAllGapDaysClosed
 */

import { prisma } from '../db';
import { Role } from '@prisma/client';
import { resolveModulesConfig } from '../utils/modules-config';
import { wereAllGapDaysClosed } from '../utils/opening-config';
import { logger } from '../lib/logger';

const STREAK_FREEZE_DAYS_GYM = 7;

/** Devuelve "ayer" (inicio del día) en UTC. TODO: soportar timezone por gym. */
function getYesterdayStart(): Date {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  return yesterday;
}

export type StreakResetResult = {
  gym_id: string;
  gym_name: string;
  reset_count: number;
  user_ids: string[];
};

export async function runStreakResetJob(): Promise<StreakResetResult[]> {
  const results: StreakResetResult[] = [];
  const yesterdayStart = getYesterdayStart();

  const gyms = await prisma.gym.findMany({
    where: { deleted_at: null, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      subscription_tier: true,
      modules_config: true,
      opening_config: true,
      last_reactivated_at: true,
    },
  });

  const now = new Date();

  for (const gym of gyms) {
    const modulesConfig = resolveModulesConfig(gym.modules_config, gym.subscription_tier);
    if (!modulesConfig.gamification) continue;

    const gymReactivationCutoff = new Date(
      now.getTime() - STREAK_FREEZE_DAYS_GYM * 24 * 60 * 60 * 1000,
    );
    const reactivatedWithinFreezeWindow =
      gym.last_reactivated_at != null && gym.last_reactivated_at >= gymReactivationCutoff;

    const users = await prisma.user.findMany({
      where: {
        gym_id: gym.id,
        role: Role.MEMBER,
        deleted_at: null,
        current_streak: { gt: 0 },
        last_checkin_date: { lt: yesterdayStart },
      },
      select: {
        id: true,
        last_checkin_date: true,
        streak_freeze_until: true,
      },
    });

    const toReset: string[] = [];

    for (const user of users) {
      if (user.last_checkin_date == null) continue;

      const withinExpiryFreeze =
        user.streak_freeze_until != null && now <= user.streak_freeze_until;

      if (withinExpiryFreeze || reactivatedWithinFreezeWindow) {
        continue;
      }

      const todayStart = new Date(yesterdayStart.getTime() + 24 * 60 * 60 * 1000);
      const allGapClosed = wereAllGapDaysClosed(
        user.last_checkin_date,
        todayStart,
        gym.opening_config,
      );

      if (allGapClosed) continue;

      toReset.push(user.id);
    }

    if (toReset.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: toReset } },
        data: { current_streak: 0 },
      });
      logger.info(
        { gymId: gym.id, gymName: gym.name, count: toReset.length, userIds: toReset },
        '[streak-reset] Streaks reset',
      );
    }

    results.push({
      gym_id: gym.id,
      gym_name: gym.name ?? gym.id,
      reset_count: toReset.length,
      user_ids: toReset,
    });
  }

  return results;
}
