import { Router } from 'express';
import { getProducts, createSale, registerExpense } from '../controllers/pos.controller';
import { openShift, closeShift } from '../controllers/shift.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/products', getProducts);           // Catálogo del POS
router.post('/sales', createSale);              // Crear venta (ACID)
router.post('/expenses', registerExpense);      // Registrar egreso de caja
router.post('/shifts/open', openShift);         // Abrir turno
router.post('/shifts/close', closeShift);       // Cerrar turno + corte de caja

export default router;
