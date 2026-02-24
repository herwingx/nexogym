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
 */
router.get('/', getUsers);

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
 */
router.post('/', createUser);

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
 */
router.patch('/:id', updateUser);

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
 */
router.delete('/:id', deleteUser);           // Soft delete

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
 */
router.patch('/:id/renew', renewSubscription);

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
 */
router.patch('/:id/freeze', freezeSubscription);

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
 */
router.patch('/:id/unfreeze', unfreezeSubscription);

export default router;
