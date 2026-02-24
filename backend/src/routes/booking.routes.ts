import { Router } from 'express';
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  createBooking,
  cancelBooking,
  getMyBookings,
  markAttendance,
} from '../controllers/booking.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireModuleEnabled } from '../middlewares/module-access.middleware';
import { requireAdminOrSuperAdmin } from '../middlewares/admin.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Class management and member reservations
 */

router.use(requireAuth);
router.use(requireModuleEnabled('classes'));

// --- Clases ---
router.get('/classes', getClasses);
router.post('/classes', requireAdminOrSuperAdmin, createClass);

/**
 * @swagger
 * /api/v1/bookings/classes/{id}:
 *   patch:
 *     summary: Update class details (Admin/Instructor)
 *     tags: [Bookings]
 *   delete:
 *     summary: Delete a class (Admin only)
 *     tags: [Bookings]
 */
router.patch('/classes/:id', requireAdminOrSuperAdmin, updateClass);
router.delete('/classes/:id', requireAdminOrSuperAdmin, deleteClass);

// --- Reservas de socios ---
/**
 * @swagger
 * /api/v1/bookings/me:
 *   get:
 *     summary: List my upcoming bookings
 *     tags: [Bookings]
 */
router.get('/me', getMyBookings);

/**
 * @swagger
 * /api/v1/bookings:
 *   post:
 *     summary: Book a slot in a class
 *     tags: [Bookings]
 */
router.post('/', createBooking);

/**
 * @swagger
 * /api/v1/bookings/{id}:
 *   delete:
 *     summary: Cancel own booking
 *     tags: [Bookings]
 */
router.delete('/:id', cancelBooking);

/**
 * @swagger
 * /api/v1/bookings/{id}/attend:
 *   patch:
 *     summary: Mark booking as attended (Admin/Instructor)
 *     tags: [Bookings]
 */
router.patch('/:id/attend', requireAdminOrSuperAdmin, markAttendance);

export default router;
