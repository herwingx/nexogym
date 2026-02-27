import { Router } from 'express';
import {
  getRewardsConfig,
  updateRewardsConfig,
  getOpeningConfig,
  updateOpeningConfig,
  updateThemeColors,
  updateLogo,
  getStaffLeaderboard,
} from '../controllers/gym.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  requireAdminOrSuperAdmin,
  requireCanUseGamification,
  requireCanViewLeaderboard,
} from '../middlewares/admin.middleware';
import { requireModuleEnabled } from '../middlewares/module-access.middleware';

const router = Router();

router.use(requireAuth);

/** PATCH /gym/theme-colors — Solo Admin (white-label). */
router.patch('/theme-colors', requireAdminOrSuperAdmin, updateThemeColors);

/** PATCH /gym/logo — Solo Admin (white-label). */
router.patch('/logo', requireAdminOrSuperAdmin, updateLogo);

router.use(requireModuleEnabled('gamification'));
router.get('/rewards-config', requireCanUseGamification, getRewardsConfig);
router.patch('/rewards-config', requireCanUseGamification, updateRewardsConfig);
router.get('/opening-config', requireCanUseGamification, getOpeningConfig);
router.patch('/opening-config', requireCanUseGamification, updateOpeningConfig);
router.get('/leaderboard', requireCanViewLeaderboard, getStaffLeaderboard);

export default router;
