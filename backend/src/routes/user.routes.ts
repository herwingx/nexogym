import { Router } from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  renewSubscription,
  freezeSubscription,
  unfreezeSubscription,
} from '../controllers/user.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Todas las rutas dentro de /api/v1/users requieren JWT de Supabase (Multitenancy)
router.use(requireAuth);

router.get('/', getUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);           // Soft delete
router.patch('/:id/renew', renewSubscription);
router.patch('/:id/freeze', freezeSubscription);
router.patch('/:id/unfreeze', unfreezeSubscription);

export default router;
