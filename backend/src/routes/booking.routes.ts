import { Router } from 'express';
import { getClasses, createClass, createBooking } from '../controllers/booking.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Class management and member reservations
 */

router.use(requireAuth);

/**
 * @swagger
 * /api/v1/bookings/classes:
 *   get:
 *     summary: Get available classes
 *     tags: [Bookings]
 */
router.get('/classes', getClasses);

/**
 * @swagger
 * /api/v1/bookings/classes:
 *   post:
 *     summary: Create a new class (Admin/Instructor)
 *     tags: [Bookings]
 */
router.post('/classes', createClass);

/**
 * @swagger
 * /api/v1/bookings:
 *   post:
 *     summary: Book a slot in a class
 *     tags: [Bookings]
 */
router.post('/', createBooking);

export default router;
