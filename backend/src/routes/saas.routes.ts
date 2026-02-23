import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireSuperAdmin } from '../middlewares/superadmin.middleware';
import { createGym, updateGymTier } from '../controllers/saas.controller';

const router = Router();

// Todas las rutas aquí requieren Auth y rol de SUPERADMIN
router.use(requireAuth, requireSuperAdmin);

// SPRINT B3: Panel del SuperAdmin -> Gestión de Gimnasios
router.post('/gyms', createGym);
router.patch('/gyms/:id/tier', updateGymTier);

export default router;
