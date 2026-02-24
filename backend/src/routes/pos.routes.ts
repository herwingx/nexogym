import { Router } from 'express';
import { getProducts, createSale, registerExpense } from '../controllers/pos.controller';
import { openShift, closeShift } from '../controllers/shift.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: POS
 *     description: Point of Sale and sales management
 *   - name: Shifts
 *     description: Cash shift management and reconciliation
 */

router.use(requireAuth);

/**
 * @swagger
 * /api/v1/pos/products:
 *   get:
 *     summary: Get POS product catalog
 *     tags: [POS]
 *     responses:
 *       200:
 *         description: List of products available for sale
 */
router.get('/products', getProducts);           // Catálogo del POS

/**
 * @swagger
 * /api/v1/pos/sales:
 *   post:
 *     summary: Create a new sale
 *     tags: [POS]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *     responses:
 *       201:
 *         description: Sale completed successfully
 */
router.post('/sales', createSale);              // Crear venta (ACID)

/**
 * @swagger
 * /api/v1/pos/expenses:
 *   post:
 *     summary: Register a cash expense
 *     tags: [POS]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - description
 *             properties:
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Expense registered successfully
 */
router.post('/expenses', registerExpense);      // Registrar egreso de caja

/**
 * @swagger
 * /api/v1/pos/shifts/open:
 *   post:
 *     summary: Open a new cash shift
 *     tags: [Shifts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - opening_balance
 *             properties:
 *               opening_balance:
 *                 type: number
 *     responses:
 *       201:
 *         description: Shift opened
 */
router.post('/shifts/open', openShift);         // Abrir turno

/**
 * @swagger
 * /api/v1/pos/shifts/close:
 *   post:
 *     summary: Close current cash shift and reconcile
 *     tags: [Shifts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actual_balance
 *             properties:
 *               actual_balance:
 *                 type: number
 *     responses:
 *       200:
 *         description: Shift closed and reconciled
 */
router.post('/shifts/close', closeShift);       // Cerrar turno + corte de caja

export default router;
