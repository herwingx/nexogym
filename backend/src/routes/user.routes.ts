import { Router } from 'express';
import {
  getMyContext,
  getUsers,
  getInstructors,
  searchUsers,
  getStaffDetail,
  getUserDetail,
  createUser,
  createStaff,
  updateUser,
  deleteUser,
  restoreUser,
  sendQrToMember,
  sendPortalAccess,
  regenerateQr,
  renewSubscription,
  freezeSubscription,
  unfreezeSubscription,
  syncExpiredSubscriptions,
  cancelSubscription,
  exportUserData,
  anonymizeUserData,
  resetPasswordByAdmin,
  getStaffLogin,
  updateStaffPermissions,
} from '../controllers/user.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  requireAdminOrSuperAdmin,
  requireCanUseReception,
  requireCanUseRoutines,
  requireCanListUsers,
  requireCanViewMembers,
  requireCanManageStaff,
} from '../middlewares/admin.middleware';

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
router.get('/', requireCanListUsers, getUsers);

/**
 * @swagger
 * /api/v1/users/instructors:
 *   get:
 *     summary: List COACH and INSTRUCTOR users (for class instructor dropdown)
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of instructors
 *       403:
 *         description: Forbidden (can_use_routines required)
 */
router.get('/instructors', requireCanUseRoutines, getInstructors);

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
router.get('/search', requireCanViewMembers, searchUsers);

router.get('/:id/staff-detail', requireCanManageStaff, getStaffDetail);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get member detail (staff with can_view_members)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member detail with visits
 *       404:
 *         description: Member not found
 */
router.get('/:id', requireCanViewMembers, getUserDetail);

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
 *                 enum: [RECEPTIONIST, COACH, INSTRUCTOR, CLEANER]
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: Staff creado; devuelve username y password para entregar en persona
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 */
router.post('/staff', requireCanManageStaff, createStaff);

router.post('/', requireCanViewMembers, createUser);

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
/**
 * @swagger
 * /api/v1/users/{id}/staff-permissions:
 *   patch:
 *     summary: Admin actualiza permisos del staff (p. ej. coach puede vender, recepcionista puede rutinas)
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
 *               can_use_pos:
 *                 type: boolean
 *               can_use_routines:
 *                 type: boolean
 *               can_use_reception:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Permisos actualizados
 *       403:
 *         description: Forbidden (Admin or SuperAdmin required)
 *       404:
 *         description: User not found
 */
router.patch('/:id/staff-permissions', requireCanManageStaff, updateStaffPermissions);

/**
 * @swagger
 * /api/v1/users/{id}/staff-login:
 *   get:
 *     summary: Admin obtiene el usuario (email) de login del staff
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: { username: string }
 *       400:
 *         description: Usuario sin cuenta de acceso
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.get('/:id/staff-login', requireCanManageStaff, getStaffLogin);

router.patch('/:id', requireCanViewMembers, updateUser);

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
router.post('/:id/send-qr', requireCanViewMembers, sendQrToMember);

/**
 * @swagger
 * /api/v1/users/{id}/send-portal-access:
 *   post:
 *     summary: Enviar acceso al portal a un socio que aún no lo tiene (ej. subida de BASIC a plan con QR)
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
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Credenciales enviadas por correo
 *       400:
 *         description: Email inválido o socio ya tiene acceso
 *       403:
 *         description: Gym sin qr_access
 *       404:
 *         description: Socio no encontrado
 *       409:
 *         description: Correo ya registrado en otro usuario
 */
router.post('/:id/send-portal-access', requireCanViewMembers, sendPortalAccess);

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
 *     summary: "Renew or update member subscription (Staff: Reception/Admin)"
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
 *               barcode:
 *                 type: string
 *                 description: "Plan a renovar (ej. MEMBERSHIP, MEMBERSHIP_ANNUAL). Si no se envía, se usa MEMBERSHIP (30 días). El monto se toma del producto en Inventario."
 *     responses:
 *       200:
 *         description: Subscription renewed successfully
 *       400:
 *         description: "Plan no válido, producto faltante en inventario, o no hay turno abierto (si precio > 0)"
 */
router.patch('/:id/renew', requireCanViewMembers, renewSubscription);

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
router.patch('/:id/freeze', requireCanViewMembers, freezeSubscription);

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
router.patch('/:id/unfreeze', requireCanViewMembers, unfreezeSubscription);

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
