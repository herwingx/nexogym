/**
 * Utilidad para interpretar rewards_config del gym de forma unificada.
 * Soporta:
 * - Formato nuevo: { streak_rewards: [ { days: number, label: string }, ... ] }
 * - Formato legacy: claves numéricas directas { "7": "Batido gratis", "30": "Mes gratis" }
 * - Formato legacy: streak_bonus { streak_7: 50, streak_30: 200 } (solo para hitos, sin label)
 */

export type StreakRewardItem = { days: number; label: string };

export type ParsedRewardsConfig = {
  /** Mapa días -> mensaje del premio (para check-in y notificación) */
  streakToLabel: Record<number, string>;
  /** Lista ordenada de hitos con label (para admin y portal socio) */
  streakRewards: StreakRewardItem[];
};

function isStreakRewardsArray(value: unknown): value is StreakRewardItem[] {
  return Array.isArray(value) && value.every(
    (item) =>
      item != null &&
      typeof item === 'object' &&
      typeof (item as StreakRewardItem).days === 'number' &&
      typeof (item as StreakRewardItem).label === 'string'
  );
}

/**
 * Parsea rewards_config del gym y devuelve un formato unificado.
 * - Si existe streak_rewards (array), se usa como fuente de verdad.
 * - Si no, se construye desde claves numéricas del objeto (legacy).
 * - streak_bonus legacy solo aporta días (sin label); el label queda "Racha N días".
 */
export function parseRewardsConfig(rewardsConfig: unknown): ParsedRewardsConfig {
  const streakToLabel: Record<number, string> = {};
  const streakRewards: StreakRewardItem[] = [];

  if (!rewardsConfig || typeof rewardsConfig !== 'object') {
    return { streakToLabel, streakRewards };
  }

  const config = rewardsConfig as Record<string, unknown>;

  // Formato nuevo: streak_rewards array
  const rawStreakRewards = config.streak_rewards;
  if (isStreakRewardsArray(rawStreakRewards)) {
    const sorted = [...rawStreakRewards].sort((a, b) => a.days - b.days);
    for (const item of sorted) {
      if (item.days > 0 && item.label.trim()) {
        streakToLabel[item.days] = item.label.trim();
        streakRewards.push({ days: item.days, label: item.label.trim() });
      }
    }
    return { streakToLabel, streakRewards };
  }

  // Legacy: claves numéricas en el objeto raíz
  for (const [key, value] of Object.entries(config)) {
    if (key === 'streak_bonus' || key === 'points_per_visit' || key === 'rewards') continue;
    const days = parseInt(key, 10);
    if (!Number.isNaN(days) && days > 0 && typeof value === 'string' && value.trim()) {
      streakToLabel[days] = value.trim();
      streakRewards.push({ days, label: value.trim() });
    }
  }

  // Legacy: streak_bonus { streak_7: 50, streak_30: 200 } → solo aporta hitos, label genérico
  const streakBonus = config.streak_bonus as Record<string, number> | undefined;
  if (streakBonus && typeof streakBonus === 'object') {
    const bonusDays = Object.keys(streakBonus)
      .map((k) => parseInt(k.replace(/^streak_/, ''), 10))
      .filter((n) => !Number.isNaN(n) && n > 0)
      .sort((a, b) => a - b);
    for (const d of bonusDays) {
      if (streakToLabel[d] == null) {
        const label = `Racha ${d} días`;
        streakToLabel[d] = label;
        streakRewards.push({ days: d, label });
      }
    }
  }

  streakRewards.sort((a, b) => a.days - b.days);
  return { streakToLabel, streakRewards };
}

/**
 * Dado el mapa días -> label, devuelve el mensaje del premio para una racha dada (o null).
 */
export function getRewardMessageForStreak(parsed: ParsedRewardsConfig, streak: number): string | null {
  return parsed.streakToLabel[streak] ?? null;
}

/** Días de gracia para congelar racha cuando el socio no renovó o descongeló su suscripción. Default 7. */
const DEFAULT_STREAK_FREEZE_DAYS = 7;

/** Lee streak_freeze_days de rewards_config (1–30). Por defecto 7. */
export function getStreakFreezeDays(rewardsConfig: unknown): number {
  if (!rewardsConfig || typeof rewardsConfig !== 'object') return DEFAULT_STREAK_FREEZE_DAYS;
  const raw = (rewardsConfig as Record<string, unknown>).streak_freeze_days;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (!Number.isNaN(n) && n >= 1 && n <= 90) return Math.round(n);
  return DEFAULT_STREAK_FREEZE_DAYS;
}

/**
 * Dado el listado de hitos, devuelve el próximo hito y su label (para next_reward del socio).
 */
export function getNextRewardMilestone(
  parsed: ParsedRewardsConfig,
  currentStreak: number
): { days: number; label: string } | null {
  const next = parsed.streakRewards.find((r) => r.days > currentStreak) ?? null;
  return next;
}
