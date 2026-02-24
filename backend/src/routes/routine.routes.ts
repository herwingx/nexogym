import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireAdminOrSuperAdmin } from '../middlewares/admin.middleware';
import { requireModuleEnabled } from '../middlewares/module-access.middleware';
import {
  createRoutine,
  getMyRoutines,
  getMemberRoutines,
  updateRoutine,
  deleteRoutine,
  addExercise,
  removeExercise,
} from '../controllers/routine.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Routines
 *   description: Training routines and exercise tracking (Module 10)
 */

router.use(requireAuth);
router.use(requireModuleEnabled('classes'));

/**
 * @swagger
 * /api/v1/routines/me:
 *   get:
 *     summary: Get my assigned routines with exercises
 *     tags: [Routines]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of routines assigned to the authenticated member
 */
router.get('/me', getMyRoutines);

/**
 * @swagger
 * /api/v1/routines/member/{userId}:
 *   get:
 *     summary: Get routines for a specific member (Admin/Instructor)
 *     tags: [Routines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member info and their routines with exercises
 *       404:
 *         description: Member not found
 */
router.get('/member/:userId', requireAdminOrSuperAdmin, getMemberRoutines);

/**
 * @swagger
 * /api/v1/routines:
 *   post:
 *     summary: Create a routine for a member (Admin/Instructor)
 *     tags: [Routines]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - name
 *             properties:
 *               userId:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Routine created
 *       404:
 *         description: Member not found
 */
router.post('/', requireAdminOrSuperAdmin, createRoutine);

/**
 * @swagger
 * /api/v1/routines/{id}:
 *   patch:
 *     summary: Update routine name or description (Admin/Instructor)
 *     tags: [Routines]
 *   delete:
 *     summary: Delete a routine and all its exercises (Admin/Instructor)
 *     tags: [Routines]
 */
router.patch('/:id', requireAdminOrSuperAdmin, updateRoutine);
router.delete('/:id', requireAdminOrSuperAdmin, deleteRoutine);

/**
 * @swagger
 * /api/v1/routines/{id}/exercises:
 *   post:
 *     summary: Add an exercise to a routine (Admin/Instructor)
 *     tags: [Routines]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - sets
 *               - reps
 *             properties:
 *               name:
 *                 type: string
 *               sets:
 *                 type: integer
 *               reps:
 *                 type: integer
 *               weight:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Exercise added
 */
router.post('/:id/exercises', requireAdminOrSuperAdmin, addExercise);

/**
 * @swagger
 * /api/v1/routines/{id}/exercises/{exerciseId}:
 *   delete:
 *     summary: Remove an exercise from a routine (Admin/Instructor)
 *     tags: [Routines]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: exerciseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exercise removed
 */
router.delete('/:id/exercises/:exerciseId', requireAdminOrSuperAdmin, removeExercise);

export default router;
