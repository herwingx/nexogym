import { Router } from 'express';
import {
  getMyContext,
  getUsers,
  searchUsers,
  createUser,
  createStaff,
  updateUser,
  deleteUser,
  restoreUser,
  sendQrToMember,
  regenerateQr,
  renewSubscription,
  freezeSubscription,
  unfreezeSubscription,
  syncExpiredSubscriptions,
  cancelSubscription,
  exportUserData,
  anonymizeUserData,
  resetPasswordByAdmin,
} from '../controllers/user.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireAdminOrSuperAdmin, requireStaff } from '../middlewares/admin.middleware';

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
 * /api/v1/users/sync-expired-subscriptions:
 *   post:
 *     summary: Mark ACTIVE subscriptions with expires_at in the past as EXPIRED (per gym). For daily cron or manual run.
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Sync result with count
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 */
router.post('/sync-expired-subscriptions', requireAdminOrSuperAdmin, syncExpiredSubscriptions);

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
 *         description: Forbidden (Staff required)
 */
router.get('/', requireStaff, getUsers);

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
 *         description: Forbidden (Staff required)
 */
router.get('/search', requireStaff, searchUsers);

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
 *               email:
 *                 type: string
 *                 description: Opcional. Si se indica para role=MEMBER, crea login y envía credenciales de portal por correo
 *               role:
 *                 type: string
 *                 enum: [ADMIN, RECEPTIONIST, MEMBER]
 *     responses:
 *       201:
 *         description: Member created successfully
 *       403:
 *         description: Forbidden (Staff required)
 */
/**
 * @swagger
 * /api/v1/users/staff:
 *   post:
 *     summary: Admin crea personal (Recep, Coach, Instructor) sin correo corporativo
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [RECEPTIONIST, COACH, INSTRUCTOR]
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: Staff creado; devuelve username y password para entregar en persona
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 */
router.post('/staff', requireAdminOrSuperAdmin, createStaff);

router.post('/', requireStaff, createUser);

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
 *         description: Forbidden (Staff required)
 */
router.patch('/:id', requireStaff, updateUser);

/**
 * @swagger
 * /api/v1/users/{id}/send-qr:
 *   post:
 *     summary: Reenviar QR de acceso del socio por WhatsApp (staff)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: QR enviado (si n8n/WhatsApp está configurado)
 *       400:
 *         description: Socio sin teléfono registrado
 *       404:
 *         description: User not found
 */
router.post('/:id/send-qr', requireStaff, sendQrToMember);

/**
 * @swagger
 * /api/v1/users/{id}/regenerate-qr:
 *   post:
 *     summary: Regenerar QR de acceso del socio (Admin only). Invalida el anterior.
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
 *               sendToWhatsApp:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: QR regenerado
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 *       404:
 *         description: User not found
 */
router.post('/:id/regenerate-qr', requireAdminOrSuperAdmin, regenerateQr);

/**
 * @swagger
 * /api/v1/users/{id}/reset-password-by-admin:
 *   post:
 *     summary: Admin resetea contraseña del staff; la nueva contraseña se envía al correo del admin.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contraseña actualizada; se envió al correo del admin.
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 *       404:
 *         description: User not found
 */
router.post('/:id/reset-password-by-admin', requireAdminOrSuperAdmin, resetPasswordByAdmin);

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
 * /api/v1/users/{id}/restore:
 *   patch:
 *     summary: Reactivar staff dado de baja
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuario reactivado
 *       400:
 *         description: Usuario ya activo o no es staff
 *       404:
 *         description: User not found
 */
router.patch('/:id/restore', requireAdminOrSuperAdmin, restoreUser);

/**
 * @swagger
 * /api/v1/users/{id}/renew:
 *   patch:
 *     summary: Renew or update member subscription (Staff: Reception/Admin)
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
 *               amount:
 *                 type: number
 *                 description: Monto cobrado. Si > 0 y hay turno abierto, registra venta en caja.
 *     responses:
 *       200:
 *         description: Subscription renewed successfully
 *       400:
 *         description: No turno abierto (si amount > 0)
 */
router.patch('/:id/renew', requireStaff, renewSubscription);

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
router.patch('/:id/freeze', requireStaff, freezeSubscription);

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
router.patch('/:id/unfreeze', requireStaff, unfreezeSubscription);

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
