import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireSuperAdmin } from '../middlewares/superadmin.middleware';
import {
  createGym,
  deleteGym,
  exportGymData,
  getGlobalMetrics,
  getGymDetail,
  getGymModules,
  listGyms,
  updateGym,
  updateGymModules,
  updateGymStatus,
  updateGymTier,
} from '../controllers/saas.controller';

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
 *               n8n_config:
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
 * /api/v1/saas/gyms:
 *   get:
 *     summary: List all gyms with stats and pagination (SuperAdmin only)
 *     tags: [SaaS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Filter by gym name
 *     responses:
 *       200:
 *         description: Paginated list of gyms with user/subscription counts
 */
router.get('/gyms', listGyms);

/**
 * @swagger
 * /api/v1/saas/gyms/{id}:
 *   get:
 *     summary: Get full detail of a gym including operational stats (SuperAdmin only)
 *     tags: [SaaS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gym detail with user count, subscription count, active subscriptions
 *       404:
 *         description: Gym not found
 */
router.get('/gyms/:id', getGymDetail);

/**
 * @swagger
 * /api/v1/saas/gyms/{id}:
 *   patch:
 *     summary: Update gym settings (name, theme_colors, n8n_config) (SuperAdmin only)
 *     tags: [SaaS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               theme_colors:
 *                 type: object
 *               n8n_config:
 *                 type: object
 *     responses:
 *       200:
 *         description: Gym updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Gym not found
 */
router.patch('/gyms/:id', updateGym);

/**
 * @swagger
 * /api/v1/saas/gyms/{id}/status:
 *   patch:
 *     summary: Set gym status ACTIVE | SUSPENDED | CANCELLED (SuperAdmin only)
 *     tags: [SaaS]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, SUSPENDED, CANCELLED]
 *     responses:
 *       200:
 *         description: Status updated; CANCELLED sets deleted_at; SUSPENDED→ACTIVE sets last_reactivated_at
 */
router.patch('/gyms/:id/status', updateGymStatus);

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

/**
 * @swagger
 * /api/v1/saas/gyms/{id}/modules:
 *   patch:
 *     summary: Update gym module overrides (SuperAdmin only)
 *     description: Enable/disable individual modules per gym, independent of tier. Merges with tier defaults.
 *     tags: [SaaS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pos: { type: boolean }
 *               qr_access: { type: boolean }
 *               gamification: { type: boolean }
 *               classes: { type: boolean }
 *               biometrics: { type: boolean }
 *     responses:
 *       200:
 *         description: Modules updated
 *       404:
 *         description: Gym not found
 */
router.patch('/gyms/:id/modules', updateGymModules);

/**
 * @swagger
 * /api/v1/saas/gyms/{id}:
 *   delete:
 *     summary: Permanently delete a gym and ALL its data (SuperAdmin only)
 *     description: |
 *       **IRREVERSIBLE.** Deletes the gym and every associated record via DB cascade
 *       (users, subscriptions, visits, sales, etc.).
 *       Requires the header `x-confirm-delete: CONFIRM_DELETE`.
 *     tags: [SaaS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-confirm-delete
 *         required: true
 *         schema:
 *           type: string
 *           enum: [CONFIRM_DELETE]
 *         description: Safety confirmation header
 *     responses:
 *       200:
 *         description: Gym and all associated data deleted
 *       400:
 *         description: Missing confirmation header
 *       404:
 *         description: Gym not found
 */
router.delete('/gyms/:id', deleteGym);

/**
 * @swagger
 * /api/v1/saas/gyms/{id}/export:
 *   get:
 *     summary: Export all data for a gym as JSON (SuperAdmin only / GDPR offboarding)
 *     tags: [SaaS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full gym data snapshot including users, subscriptions, sales, audit logs
 *       404:
 *         description: Gym not found
 */
router.get('/gyms/:id/export', exportGymData);

/**
 * @swagger
 * /api/v1/saas/gyms/{id}/modules:
 *   get:
 *     summary: Get resolved module flags for a gym (SuperAdmin only)
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
 *     responses:
 *       200:
 *         description: Resolved modules config for the gym
 *       404:
 *         description: Gym not found
 */
router.get('/gyms/:id/modules', getGymModules);
router.get('/metrics', getGlobalMetrics);

export default router;
