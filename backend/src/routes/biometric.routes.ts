import { Router } from 'express';
import { requireHardwareKey } from '../middlewares/hardware.middleware';
import { biometricCheckIn } from '../controllers/biometric.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Biometric
 *   description: IoT Hardware integration for physical access control
 */

/**
 * @swagger
 * /biometric/checkin:
 *   post:
 *     summary: Process biometric access from physical hardware
 *     tags: [Biometric]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: true
 *         schema:
 *           type: string
 *         description: Hardware API key unique per gym
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - footprint_id
 *             properties:
 *               footprint_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access granted
 *       401:
 *         description: Invalid API Key
 *       403:
 *         description: Subscription expired
 */
router.post('/checkin', requireHardwareKey, biometricCheckIn);

export default router;
