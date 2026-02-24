import { Router } from 'express';
import {
  getMyContext,
  getUsers,
  searchUsers,
  createUser,
  updateUser,
  deleteUser,
  renewSubscription,
  freezeSubscription,
  unfreezeSubscription,
  cancelSubscription,
  exportUserData,
  anonymizeUserData,
} from '../controllers/user.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireAdminOrSuperAdmin } from '../middlewares/admin.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Member CRM and subscription lifecycle management
 */

// Todas las rutas dentro de /api/v1/users requieren JWT de Supabase (Multitenancy)
router.use(requireAuth);

/**
 * @swagger
 * /api/v1/users/me/context:
 *   get:
 *     summary: Get authenticated user and gym feature context
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: User context for frontend bootstrap
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Context not found
 */
router.get('/me/context', getMyContext);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Get all members of the gym
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of members
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 */
router.get('/', requireAdminOrSuperAdmin, getUsers);

/**
 * @swagger
 * /api/v1/users/search:
 *   get:
 *     summary: Search members by name or phone (reception flow)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search text (min 2 chars)
 *     responses:
 *       200:
 *         description: Matching members list
 *       400:
 *         description: Invalid query
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 */
router.get('/search', requireAdminOrSuperAdmin, searchUsers);

/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Register a new member
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, RECEPTIONIST, MEMBER]
 *     responses:
 *       201:
 *         description: Member created successfully
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 */
router.post('/', requireAdminOrSuperAdmin, createUser);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   patch:
 *     summary: Update member information
 *     tags: [Users]
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
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Member updated successfully
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 */
router.patch('/:id', requireAdminOrSuperAdmin, updateUser);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   delete:
 *     summary: Soft-delete a member
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member deleted successfully
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 */
router.delete('/:id', requireAdminOrSuperAdmin, deleteUser);           // Soft delete

/**
 * @swagger
 * /api/v1/users/{id}/renew:
 *   patch:
 *     summary: Renew or update member subscription
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription renewed successfully
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 */
router.patch('/:id/renew', requireAdminOrSuperAdmin, renewSubscription);

/**
 * @swagger
 * /api/v1/users/{id}/freeze:
 *   patch:
 *     summary: Freeze member subscription
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription frozen successfully
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 */
router.patch('/:id/freeze', requireAdminOrSuperAdmin, freezeSubscription);

/**
 * @swagger
 * /api/v1/users/{id}/unfreeze:
 *   patch:
 *     summary: Unfreeze member subscription
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription unfrozen successfully
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 */
router.patch('/:id/unfreeze', requireAdminOrSuperAdmin, unfreezeSubscription);

/**
 * @swagger
 * /api/v1/users/{id}/cancel-subscription:
 *   patch:
 *     summary: Cancel member subscription immediately
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription cancelled
 *       404:
 *         description: Active or frozen subscription not found
 */
router.patch('/:id/cancel-subscription', requireAdminOrSuperAdmin, cancelSubscription);

/**
 * @swagger
 * /api/v1/users/{id}/data-export:
 *   get:
 *     summary: Export member personal and operational data (JSON)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Data export payload
 *       404:
 *         description: User not found
 */
router.get('/:id/data-export', requireAdminOrSuperAdmin, exportUserData);

/**
 * @swagger
 * /api/v1/users/{id}/anonymize:
 *   post:
 *     summary: Anonymize member personal data and cancel active subscription
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User data anonymized
 *       404:
 *         description: User not found
 */
router.post('/:id/anonymize', requireAdminOrSuperAdmin, anonymizeUserData);

export default router;
