import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { requireAuth } from '../middlewares/auth.middleware';
import { getMemberProfile, getMemberHistory, requestQrResend } from '../controllers/member.controller';

const router = Router();

/** Only MEMBER role can access portal del socio */
const requireMember = (req: Request, res: Response, next: NextFunction) => {
  if (req.userRole !== Role.MEMBER) {
    res.status(403).json({ error: 'Forbidden: Member portal only.' });
    return;
  }
  next();
};

router.use(requireAuth);
router.use(requireMember);

/**
 * @swagger
 * /api/v1/members/me:
 *   get:
 *     summary: Get my member profile (portal del socio)
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Member profile with membership, streak, next reward
 */
router.get('/me', getMemberProfile);

/**
 * @swagger
 * /api/v1/members/me/history:
 *   get:
 *     summary: Get my visit history
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated visit history
 */
router.get('/me/history', getMemberHistory);

/**
 * @swagger
 * /api/v1/members/me/send-qr:
 *   post:
 *     summary: Reenviar mi QR de acceso por WhatsApp (mismo código estable)
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: QR enviado (si el gym tiene n8n/WhatsApp configurado)
 *       400:
 *         description: Sin teléfono registrado
 */
router.post('/me/send-qr', requestQrResend);

export default router;
