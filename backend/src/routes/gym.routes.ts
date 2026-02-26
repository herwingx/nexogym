import { Router } from 'express';
import { getRewardsConfig, updateRewardsConfig } from '../controllers/gym.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireAdminOrSuperAdmin } from '../middlewares/admin.middleware';
import { requireModuleEnabled } from '../middlewares/module-access.middleware';

const router = Router();

/**
 * Rutas de configuración del gym (admin del tenant).
 * Requieren: auth, rol Admin o SuperAdmin, y módulo gamification activo.
 */
router.use(requireAuth);
router.use(requireAdminOrSuperAdmin);
router.use(requireModuleEnabled('gamification'));

router.get('/rewards-config', getRewardsConfig);
router.patch('/rewards-config', updateRewardsConfig);

export default router;
