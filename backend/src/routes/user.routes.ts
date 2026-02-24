import { Router } from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  renewSubscription,
  freezeSubscription,
  unfreezeSubscription,
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - months
 *             properties:
 *               months:
 *                 type: number
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

export default router;
