import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireCoachOrAdmin } from '../middlewares/admin.middleware';
import { requireModuleEnabled } from '../middlewares/module-access.middleware';
import { listExercises, createExercise } from '../controllers/exercise.controller';

const router = Router();

router.use(requireAuth);
router.use(requireModuleEnabled('classes'));

router.get('/', requireCoachOrAdmin, listExercises);
router.post('/', requireCoachOrAdmin, createExercise);

export default router;
