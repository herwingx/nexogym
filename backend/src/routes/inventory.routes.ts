import { Router } from 'express';
import {
  getProducts,
  createProduct,
  deleteProduct,
  restockProduct,
  adjustLoss,
} from '../controllers/inventory.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireModuleEnabled } from '../middlewares/module-access.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Product stock and inventory management
 */

// Todas las rutas de inventario requieren autenticación JWT (Multitenancy)
router.use(requireAuth);
router.use(requireModuleEnabled('pos'));

/**
 * @swagger
 * /api/v1/inventory/products:
 *   get:
 *     summary: List all products in inventory
 *     tags: [Inventory]
 *     responses:
 *       200:
 *         description: List of products
 */
router.get('/products', getProducts);

/**
 * @swagger
 * /api/v1/inventory/products:
 *   post:
 *     summary: Add a new product to inventory
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *               barcode:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: number
 *     responses:
 *       201:
 *         description: Product created successfully
 */
router.post('/products', createProduct);

/**
 * @swagger
 * /api/v1/inventory/products/{id}:
 *   delete:
 *     summary: Soft-delete a product
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product deleted successfully
 */
router.delete('/products/:id', deleteProduct);      // Soft delete

/**
 * @swagger
 * /api/v1/inventory/restock:
 *   post:
 *     summary: Restock an existing product
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stock updated
 */
router.post('/restock', restockProduct);

/**
 * @swagger
 * /api/v1/inventory/loss:
 *   post:
 *     summary: Record product loss (shrinkage)
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *               - reason
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Loss recorded and stock adjusted
 */
router.post('/loss', adjustLoss);                   // Merma — requiere justificación

export default router;
