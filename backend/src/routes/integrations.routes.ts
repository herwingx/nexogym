import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireAdminOrSuperAdmin } from '../middlewares/admin.middleware';
import { getBirthdays } from '../controllers/integrations.controller';

const router = Router();

router.use(requireAuth);
router.use(requireAdminOrSuperAdmin);

router.get('/birthdays', getBirthdays);

export default router;
