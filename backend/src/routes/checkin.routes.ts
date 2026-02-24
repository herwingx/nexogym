import { Router } from 'express';
import { processCheckin, processCourtesyAccess } from '../controllers/checkin.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Check-in
 *   description: Member attendance and access control
 */

router.use(requireAuth);

/**
 * @swagger
 * /api/v1/checkin:
 *   post:
 *     summary: Process a member check-in
 *     tags: [Check-in]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *               accessMethod:
 *                 type: string
 *                 enum: [MANUAL, QR]
 *     responses:
 *       200:
 *         description: Check-in successful
 *       403:
 *         description: Forbidden (No active subscription)
 */
router.post('/', processCheckin);

/**
 * @swagger
 * /api/v1/checkin/courtesy:
 *   post:
 *     summary: Grant courtesy access (Admin only)
 *     tags: [Check-in]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Courtesy access granted
 *       403:
 *         description: Forbidden (Unauthorized role)
 */
router.post('/courtesy', processCourtesyAccess); // ADMIN only — guarded inside the controller

export default router;
