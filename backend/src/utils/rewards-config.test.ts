import { describe, it, expect } from 'vitest';
import {
  parseRewardsConfig,
  getRewardMessageForStreak,
  getNextRewardMilestone,
} from './rewards-config';

describe('rewards-config', () => {
  describe('parseRewardsConfig', () => {
    it('returns empty when config is null or empty', () => {
      expect(parseRewardsConfig(null).streakRewards).toEqual([]);
      expect(parseRewardsConfig(undefined).streakRewards).toEqual([]);
      expect(parseRewardsConfig({}).streakRewards).toEqual([]);
    });

    it('uses streak_rewards array when present', () => {
      const config = {
        streak_rewards: [
          { days: 7, label: 'Batido gratis' },
          { days: 30, label: 'Mes gratis' },
        ],
      };
      const parsed = parseRewardsConfig(config);
      expect(parsed.streakRewards).toEqual([
        { days: 7, label: 'Batido gratis' },
        { days: 30, label: 'Mes gratis' },
      ]);
      expect(parsed.streakToLabel[7]).toBe('Batido gratis');
      expect(parsed.streakToLabel[30]).toBe('Mes gratis');
    });

    it('uses legacy numeric keys when no streak_rewards', () => {
      const config = { '7': 'Batido', '30': 'Mes gratis' };
      const parsed = parseRewardsConfig(config);
      expect(parsed.streakRewards).toEqual([
        { days: 7, label: 'Batido' },
        { days: 30, label: 'Mes gratis' },
      ]);
      expect(parsed.streakToLabel[7]).toBe('Batido');
    });

    it('uses streak_bonus legacy for milestones with generic label', () => {
      const config = { streak_bonus: { streak_7: 50, streak_30: 200 } };
      const parsed = parseRewardsConfig(config);
      expect(parsed.streakRewards).toEqual([
        { days: 7, label: 'Racha 7 días' },
        { days: 30, label: 'Racha 30 días' },
      ]);
      expect(parsed.streakToLabel[7]).toBe('Racha 7 días');
    });
  });

  describe('getRewardMessageForStreak', () => {
    it('returns label when streak matches', () => {
      const parsed = parseRewardsConfig({
        streak_rewards: [{ days: 7, label: 'Batido' }],
      });
      expect(getRewardMessageForStreak(parsed, 7)).toBe('Batido');
      expect(getRewardMessageForStreak(parsed, 3)).toBeNull();
    });
  });

  describe('getNextRewardMilestone', () => {
    it('returns next milestone and label', () => {
      const parsed = parseRewardsConfig({
        streak_rewards: [
          { days: 7, label: 'Batido' },
          { days: 30, label: 'Mes gratis' },
        ],
      });
      expect(getNextRewardMilestone(parsed, 2)).toEqual({ days: 7, label: 'Batido' });
      expect(getNextRewardMilestone(parsed, 7)).toEqual({ days: 30, label: 'Mes gratis' });
      expect(getNextRewardMilestone(parsed, 30)).toBeNull();
      expect(getNextRewardMilestone(parsed, 31)).toBeNull();
    });
  });
});
