import { Router } from 'express';
import {
  getProducts,
  createProduct,
  deleteProduct,
  restockProduct,
  adjustLoss,
} from '../controllers/inventory.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Todas las rutas de inventario requieren autenticación JWT (Multitenancy)
router.use(requireAuth);

router.get('/products', getProducts);
router.post('/products', createProduct);
router.delete('/products/:id', deleteProduct);      // Soft delete
router.post('/restock', restockProduct);
router.post('/loss', adjustLoss);                   // Merma — requiere justificación

export default router;
