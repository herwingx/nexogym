import { Router } from 'express';
import {
  listPromotions,
  createPromotion,
  updatePromotion,
  getPromotion,
} from '../controllers/promotion.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireModuleEnabled } from '../middlewares/module-access.middleware';
import { requireAdminOrSuperAdmin, requireCanUsePos } from '../middlewares/admin.middleware';

const router = Router();

router.use(requireAuth);
router.use(requireModuleEnabled('pos')); // Promos se usan en POS

/**
 * GET /promotions — Admin: todas; Staff (can_use_pos): solo activas
 */
router.get('/', requireCanUsePos, listPromotions);

/**
 * GET /promotions/:id — Detalle
 */
router.get('/:id', requireCanUsePos, getPromotion);

/**
 * POST /promotions — Admin crea promo
 */
router.post('/', requireAdminOrSuperAdmin, createPromotion);

/**
 * PATCH /promotions/:id — Admin edita (incl. activar/desactivar)
 */
router.patch('/:id', requireAdminOrSuperAdmin, updatePromotion);

export default router;
