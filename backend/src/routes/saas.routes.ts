import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireSuperAdmin } from '../middlewares/superadmin.middleware';
import { createGym, getGlobalMetrics, updateGymTier } from '../controllers/saas.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: SaaS
 *   description: SuperAdmin panel for gym management
 */

// Todas las rutas aquí requieren Auth y rol de SUPERADMIN
router.use(requireAuth, requireSuperAdmin);

/**
 * @swagger
 * /api/v1/saas/gyms:
 *   post:
 *     summary: Create a new gym (SuperAdmin only)
 *     tags: [SaaS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               subscription_tier:
 *                 type: string
 *                 enum: [BASIC, PRO_QR, PREMIUM_BIO]
 *               modules_config:
 *                 type: object
 *     responses:
 *       201:
 *         description: Gym created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not a SuperAdmin)
 */
router.post('/gyms', createGym);

/**
 * @swagger
 * /api/v1/saas/gyms/{id}/tier:
 *   patch:
 *     summary: Update gym subscription tier (SuperAdmin only)
 *     tags: [SaaS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Gym ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscription_tier
 *             properties:
 *               subscription_tier:
 *                 type: string
 *                 enum: [BASIC, PRO_QR, PREMIUM_BIO]
 *     responses:
 *       200:
 *         description: Gym tier updated successfully
 *       404:
 *         description: Gym not found
 */
router.patch('/gyms/:id/tier', updateGymTier);
router.get('/metrics', getGlobalMetrics);

export default router;
