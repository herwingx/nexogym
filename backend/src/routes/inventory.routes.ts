import { Router } from 'express';
import {
  getProducts,
  createProduct,
  deleteProduct,
  updateProduct,
  restockProduct,
  adjustLoss,
  getInventoryTransactions,
} from '../controllers/inventory.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireModuleEnabled } from '../middlewares/module-access.middleware';
import { requireAdminOrSuperAdmin, requireCanUsePos } from '../middlewares/admin.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Product stock and inventory management
 */

// Todas las rutas de inventario requieren autenticación JWT (Multitenancy) y rol Staff
router.use(requireAuth);
router.use(requireModuleEnabled('pos'));
router.use(requireCanUsePos); // Inventario: Admin/SuperAdmin o staff con permiso "puede vender"

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
router.post('/products', requireAdminOrSuperAdmin, createProduct); // Solo Admin crea productos (precios, etc.)

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
 *       403:
 *         description: Forbidden (Admin only — reception cannot delete products)
 */
router.delete('/products/:id', requireAdminOrSuperAdmin, deleteProduct);      // Soft delete — solo admin

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
 *       403:
 *         description: Forbidden (Admin only — reception cannot report loss)
 */
router.post('/loss', requireAdminOrSuperAdmin, adjustLoss);                   // Merma — solo admin (anti-fraude)

/**
 * @swagger
 * /api/v1/inventory/products/{id}:
 *   patch:
 *     summary: Update product name, barcode or price
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               barcode:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Product updated
 *       404:
 *         description: Product not found
 */
router.patch('/products/:id', requireAdminOrSuperAdmin, updateProduct); // Solo Admin edita precios (evitar manipulación)

/**
 * @swagger
 * /api/v1/inventory/transactions:
 *   get:
 *     summary: Get inventory movement history (restocks, losses, sales)
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [RESTOCK, LOSS, SALE]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Paginated inventory transaction history
 */
router.get('/transactions', getInventoryTransactions);

export default router;
