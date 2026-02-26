import { Request, Response } from 'express';
import { prisma } from '../db';
import { TransactionType } from '@prisma/client';
import { logAuditEvent } from '../utils/audit.logger';
import { handleControllerError } from '../utils/http';

// GET /inventory/products
export const getProducts = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const products = await prisma.product.findMany({
      where: { gym_id: gymId, deleted_at: null }, // Excluir soft-deleted
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ data: products });
  } catch (error) {
    handleControllerError(req, res, error, '[getProducts Error]', 'Failed to retrieve products.');
  }
};

// POST /inventory/products
export const createProduct = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const actorId = req.user?.id;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { name, barcode, price, stock } = req.body;
    if (!name || price === undefined) {
      res.status(400).json({ error: 'name and price are required.' });
      return;
    }

    const product = await prisma.product.create({
      data: {
        gym_id: gymId,
        name,
        barcode: barcode ?? null,
        price,
        stock: stock ?? 0,
      },
    });

    if (actorId) {
      await logAuditEvent(gymId, actorId, 'PRODUCT_CREATED', {
        product_id: product.id,
        name: product.name,
        barcode: product.barcode,
        price: Number(product.price),
        stock: product.stock,
      });
    }

    res.status(201).json({ message: 'Product created.', product });
  } catch (error) {
    handleControllerError(req, res, error, '[createProduct Error]', 'Failed to create product.');
  }
};

// DELETE /inventory/products/:id — SOFT DELETE
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const actorId = req.user?.id;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;

    const product = await prisma.product.findFirst({
      where: { id, gym_id: gymId, deleted_at: null },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found or already deleted.' });
      return;
    }

    // SOFT DELETE — NUNCA usar prisma.product.delete()
    await prisma.product.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { deleted_at: new Date() } as any,
    });

    if (actorId) {
      await logAuditEvent(gymId, actorId, 'PRODUCT_DELETED', {
        product_id: id,
        name: product.name,
        barcode: product.barcode,
      });
    }

    res.status(200).json({ message: 'Product soft-deleted successfully.' });
  } catch (error) {
    handleControllerError(req, res, error, '[deleteProduct Error]', 'Failed to delete product.');
  }
};

/**
 * POST /inventory/restock
 * Recibe stock de nuevos productos. Atómico: actualiza stock + crea InventoryTransaction.
 */
export const restockProduct = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const actorId = req.user?.id;

    if (!gymId || !actorId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { productId, quantity, reason } = req.body;
    if (!productId || !quantity || quantity <= 0) {
      res.status(400).json({ error: 'productId and a positive quantity are required.' });
      return;
    }

    // Verify product belongs to this gym
    const product = await prisma.product.findFirst({
      where: { id: productId, gym_id: gymId, deleted_at: null },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found in this gym.' });
      return;
    }

    // ACID Transaction: update stock + record transaction
    const [updatedProduct, transaction] = await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { stock: product.stock + quantity },
      }),
      prisma.inventoryTransaction.create({
        data: {
          gym_id: gymId,
          product_id: productId,
          user_id: actorId,
          type: TransactionType.RESTOCK,
          quantity,
          reason: reason ?? null,
        },
      }),
    ]);

    if (actorId) {
      await logAuditEvent(gymId, actorId, 'INVENTORY_RESTOCKED', {
        product_id: productId,
        product_name: product.name,
        quantity,
        reason: reason ?? null,
        transaction_id: transaction.id,
      });
    }

    res.status(200).json({
      message: `Restocked ${quantity} units of "${product.name}".`,
      new_stock: updatedProduct.stock,
      transaction_id: transaction.id,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[restockProduct Error]', 'Failed to restock product.');
  }
};

/**
 * POST /inventory/loss
 * Registra baja de producto por rotura, caducidad, etc.
 * La justificación es OBLIGATORIA para el control anti-robos.
 * Registrado en AuditLog para que el dueño pueda auditar las "mermas".
 */
export const adjustLoss = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const actorId = req.user?.id;

    if (!gymId || !actorId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { productId, quantity, reason } = req.body;
    if (!productId || !quantity || quantity <= 0) {
      res.status(400).json({ error: 'productId and a positive quantity are required.' });
      return;
    }

    if (!reason || String(reason).trim().length === 0) {
      res.status(400).json({ error: 'reason is required for a loss adjustment (anti-theft policy).' });
      return;
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, gym_id: gymId, deleted_at: null },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found in this gym.' });
      return;
    }

    if (product.stock < quantity) {
      res.status(400).json({
        error: `Cannot report loss of ${quantity} units. Current stock: ${product.stock}.`,
      });
      return;
    }

    // ACID Transaction: deduct stock + record transaction
    const [updatedProduct, transaction] = await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { stock: product.stock - quantity },
      }),
      prisma.inventoryTransaction.create({
        data: {
          gym_id: gymId,
          product_id: productId,
          user_id: actorId,
          type: TransactionType.LOSS,
          quantity,
          reason,
        },
      }),
    ]);

    // AuditLog: CRÍTICO — el dueño debe poder ver quién reportó la merma
    await logAuditEvent(gymId, actorId, 'INVENTORY_LOSS_REPORTED', {
      product_id: productId,
      product_name: product.name,
      quantity_lost: quantity,
      reason,
      transaction_id: transaction.id,
    });

    res.status(200).json({
      message: `Loss of ${quantity} units of "${product.name}" registered.`,
      new_stock: updatedProduct.stock,
      transaction_id: transaction.id,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[adjustLoss Error]', 'Failed to register inventory loss.');
  }
};

// PATCH /inventory/products/:id
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const actorId = req.user?.id;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;
    const { name, barcode, price } = req.body;

    if (!name && barcode === undefined && price === undefined) {
      res.status(400).json({ error: 'At least one field (name, barcode, price) must be provided.' });
      return;
    }

    const existing = await prisma.product.findFirst({
      where: { id, gym_id: gymId, deleted_at: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(barcode !== undefined && { barcode }),
        ...(price !== undefined && { price }),
      },
    });

    if (actorId) {
      const details: Record<string, unknown> = { product_id: id };
      if (name !== undefined && name !== existing.name) details.name_before = existing.name;
      if (name !== undefined && name !== existing.name) details.name_after = updated.name;
      if (barcode !== undefined && barcode !== existing.barcode) details.barcode_before = existing.barcode;
      if (barcode !== undefined && barcode !== existing.barcode) details.barcode_after = updated.barcode;
      if (price !== undefined && Number(price) !== Number(existing.price)) {
        details.price_before = Number(existing.price);
        details.price_after = Number(updated.price);
      }
      if (Object.keys(details).length > 1) {
        await logAuditEvent(gymId, actorId, 'PRODUCT_UPDATED', details);
      }
    }

    res.status(200).json({ message: 'Product updated.', product: updated });
  } catch (error) {
    handleControllerError(req, res, error, '[updateProduct Error]', 'Failed to update product.');
  }
};

// GET /inventory/transactions?productId=&type=RESTOCK|LOSS|SALE&page=1&limit=50
export const getInventoryTransactions = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { productId, type, page = '1', limit = '50' } = req.query;
    const take = Math.min(Number(limit) || 50, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: any = { gym_id: gymId };
    if (productId) where.product_id = String(productId);
    if (type) where.type = String(type);

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        include: { product: { select: { name: true, barcode: true } } },
        orderBy: { created_at: 'desc' },
        take,
        skip,
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    res.status(200).json({
      data: transactions,
      meta: { total, page: Number(page), limit: take },
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getInventoryTransactions Error]', 'Failed to retrieve inventory transactions.');
  }
};
