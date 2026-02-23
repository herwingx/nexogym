import { Router } from 'express';
import { processCheckin, processCourtesyAccess } from '../controllers/checkin.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

router.post('/', processCheckin);
router.post('/courtesy', processCourtesyAccess); // ADMIN only — guarded inside the controller

export default router;
