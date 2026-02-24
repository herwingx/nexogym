import { Request, Response } from 'express';
import { prisma } from '../db';
import { ShiftStatus, TransactionType } from '@prisma/client';
import { saleSchema, expenseSchema } from '../schemas/pos.schema';

// GET /pos/products — mirrors inventory but from a POS-optimized view
export const getProducts = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const products = await prisma.product.findMany({
      where: { gym_id: gymId, deleted_at: null },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ data: products });
  } catch (error) {
    console.error('[getProducts Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve products.' });
  }
};

/**
 * POST /pos/sales
 * Crea una venta en la caja activa.
 * ACID ($transaction):
 *   1. Valida y descuenta stock de cada producto
 *   2. Crea la Sale con el cash_shift_id del turno abierto
 *   3. Crea cada SaleItem con precio histórico
 *   4. Crea un InventoryTransaction tipo SALE por cada producto
 */
export const createSale = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const actorId = req.user?.id;
    if (!gymId || !actorId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    // 0. Zod Validation
    const validation = saleSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const { items, sellerId } = validation.data;

    // Find the currently open shift for this gym (required to link the sale)
    const openShift = await prisma.cashShift.findFirst({
      where: { gym_id: gymId, status: ShiftStatus.OPEN },
    });

    if (!openShift) {
      res.status(400).json({ error: 'No open shift found. Please open a cash shift before making a sale.' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const saleItemsData: { gym_id: string; product_id: string; quantity: number; price: any }[] = [];
      const inventoryTxData: { gym_id: string; product_id: string; type: TransactionType; quantity: number; reason: string }[] = [];

      for (const item of items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, gym_id: gymId, deleted_at: null },
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found.`);
        }

        if (product.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}.`
          );
        }

        const lineTotal = Number(product.price) * item.quantity;
        totalAmount += lineTotal;

        saleItemsData.push({
          gym_id: gymId,
          product_id: product.id,
          quantity: item.quantity,
          price: product.price, // Lock historical price
        });

        inventoryTxData.push({
          gym_id: gymId,
          product_id: product.id,
          type: TransactionType.SALE,
          quantity: item.quantity,
          reason: `POS Sale — Shift #${openShift.id}`,
        });

        // Deduct stock
        await tx.product.update({
          where: { id: product.id },
          data: { stock: product.stock - item.quantity },
        });
      }

      // Create parent Sale linked to the open shift
      const sale = await tx.sale.create({
        data: {
          gym_id: gymId,
          cash_shift_id: openShift.id,
          seller_id: sellerId || actorId, // TRACK COMMISSION: specific seller or the actor
          total: totalAmount,
          items: { create: saleItemsData },
        },
        include: { items: true },
      });

      // Record InventoryTransactions for each sold product (audit trail)
      await tx.inventoryTransaction.createMany({ data: inventoryTxData });

      return sale;
    });

    res.status(201).json({
      message: 'Sale completed successfully.',
      sale: result,
    });
  } catch (error: any) {
    console.error('[createSale Error]:', error);
    res.status(400).json({ error: error.message || 'Failed to complete sale.' });
  }
};

/**
 * POST /pos/expenses
 * Registra un egreso de caja en el turno activo.
 * Ej: pago de garrafones, compra de papel para recibos, propinas.
 */
export const registerExpense = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const actorId = req.user?.id;

    if (!gymId || !actorId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    // 0. Zod Validation
    const validation = expenseSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const { amount, description } = validation.data;

    // Must have an open shift
    const openShift = await prisma.cashShift.findFirst({
      where: { gym_id: gymId, status: ShiftStatus.OPEN },
    });

    if (!openShift) {
      res.status(400).json({ error: 'No open shift found. Expenses must be tied to an active shift.' });
      return;
    }

    // Create the expense linked to the current shift
    const expense = await prisma.expense.create({
      data: {
        gym_id: gymId,
        cash_shift_id: openShift.id,
        amount,
        description,
      },
    });

    res.status(201).json({
      message: 'Expense registered.',
      expense,
    });
  } catch (error) {
    console.error('[registerExpense Error]:', error);
    res.status(500).json({ error: 'Failed to register expense.' });
  }
};