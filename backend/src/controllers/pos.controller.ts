import { Request, Response } from 'express';
import { prisma } from '../db';
import { ShiftStatus, TransactionType } from '@prisma/client';
import { saleSchema, expenseSchema } from '../schemas/pos.schema';
import { handleControllerError } from '../utils/http';
import { getNextSaleFolio } from '../utils/receipt-folio';
import { sendSaleReceiptEmail } from '../services/n8n.service';

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
    handleControllerError(req, res, error, '[getProducts Error]', 'Failed to retrieve products.');
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

    const { items, sellerId, customer_email: customerEmailRaw } = validation.data;
    const customerEmail = typeof customerEmailRaw === 'string' && customerEmailRaw.trim() ? customerEmailRaw.trim() : undefined;

    // Find the currently open shift for this user/gym (sales go to the seller's shift)
    const openShift = await prisma.cashShift.findFirst({
      where: { gym_id: gymId, user_id: actorId, status: ShiftStatus.OPEN },
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

      const receiptFolio = await getNextSaleFolio(gymId, tx);

      const sale = await tx.sale.create({
        data: {
          gym_id: gymId,
          cash_shift_id: openShift.id,
          seller_id: sellerId || actorId,
          total: totalAmount,
          receipt_folio: receiptFolio,
          items: { create: saleItemsData },
        },
        include: { items: { include: { product: { select: { name: true } } } } },
      });

      // Record InventoryTransactions for each sold product (audit trail)
      await tx.inventoryTransaction.createMany({ data: inventoryTxData });

      return sale;
    });

    if (customerEmail && result) {
      const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { name: true } });
      const items = result.items.map((item: { quantity: number; price: { toString: () => string }; product: { name: string } }) => {
        const unitPrice = Number(item.price);
        return {
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: unitPrice,
          line_total: unitPrice * item.quantity,
        };
      });
      sendSaleReceiptEmail(gymId, customerEmail, {
        receipt_folio: result.receipt_folio ?? result.id,
        sale_id: result.id,
        items,
        total: Number(result.total),
        sold_at: result.created_at.toISOString(),
        gym_name: gym?.name ?? null,
      }).catch(() => {});
    }

    res.status(201).json({
      message: 'Sale completed successfully.',
      sale: result,
    });
  } catch (error: any) {
    req.log?.error({ err: error }, '[createSale Error]');
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

    const { amount, type, description } = validation.data;

    // Must have an open shift for this user (expenses go to the current user's shift)
    const openShift = await prisma.cashShift.findFirst({
      where: { gym_id: gymId, user_id: actorId, status: ShiftStatus.OPEN },
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
        type,
        amount,
        description: description?.trim() || null,
      },
    });

    res.status(201).json({
      message: 'Expense registered.',
      expense,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[registerExpense Error]', 'Failed to register expense.');
  }
};

// GET /pos/sales?shiftId=&date=YYYY-MM-DD&page=1&limit=50
export const getSales = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { shiftId, date, page = '1', limit = '50' } = req.query;
    const take = Math.min(Number(limit) || 50, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: any = { gym_id: gymId };
    if (shiftId) where.cash_shift_id = String(shiftId);
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);
      where.created_at = { gte: dayStart, lte: dayEnd };
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          items: { include: { product: { select: { name: true } } } },
          seller: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
        take,
        skip,
      }),
      prisma.sale.count({ where }),
    ]);

    res.status(200).json({
      data: sales,
      meta: { total, page: Number(page), limit: take },
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getSales Error]', 'Failed to retrieve sales.');
  }
};

// GET /pos/shifts/current
export const getCurrentShift = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const userId = req.user?.id;
    if (!gymId || !userId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const shift = await prisma.cashShift.findFirst({
      where: { gym_id: gymId, user_id: userId, status: ShiftStatus.OPEN },
    });

    if (!shift) {
      res.status(200).json({ shift: null, running_totals: null });
      return;
    }

    const [salesAgg, expensesAgg, saleCount] = await Promise.all([
      prisma.sale.aggregate({
        where: { gym_id: gymId, cash_shift_id: shift.id },
        _sum: { total: true },
      }),
      prisma.expense.aggregate({
        where: { gym_id: gymId, cash_shift_id: shift.id },
        _sum: { amount: true },
      }),
      prisma.sale.count({ where: { gym_id: gymId, cash_shift_id: shift.id } }),
    ]);

    const totalSales = Number(salesAgg._sum.total || 0);
    const totalExpenses = Number(expensesAgg._sum.amount || 0);
    const expectedBalance = Number(shift.opening_balance) + totalSales - totalExpenses;

    res.status(200).json({
      shift,
      running_totals: {
        total_sales: totalSales,
        sale_count: saleCount,
        total_expenses: totalExpenses,
        expected_balance: expectedBalance,
      },
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getCurrentShift Error]', 'Failed to retrieve current shift.');
  }
};

// GET /pos/shifts?page=1&limit=20
export const getShifts = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { page = '1', limit = '20' } = req.query;
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [shifts, total] = await Promise.all([
      prisma.cashShift.findMany({
        where: { gym_id: gymId, status: ShiftStatus.CLOSED },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { closed_at: 'desc' },
        take,
        skip,
      }),
      prisma.cashShift.count({ where: { gym_id: gymId, status: ShiftStatus.CLOSED } }),
    ]);

    res.status(200).json({
      data: shifts,
      meta: { total, page: Number(page), limit: take },
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getShifts Error]', 'Failed to retrieve shifts.');
  }
};

// GET /pos/shifts/open — Admin: list all open shifts in the gym (who has turn open, no corte yet)
export const getOpenShifts = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const openShifts = await prisma.cashShift.findMany({
      where: { gym_id: gymId, status: ShiftStatus.OPEN },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { opened_at: 'asc' },
    });

    res.status(200).json({ data: openShifts });
  } catch (error) {
    handleControllerError(req, res, error, '[getOpenShifts Error]', 'Failed to retrieve open shifts.');
  }
};

// GET /pos/shifts/:id/sales — Admin: ventas (transacciones) de un corte con folios para auditoría
export const getShiftSales = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const shiftId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }
    if (!shiftId) {
      res.status(400).json({ error: 'ID de turno inválido.' });
      return;
    }

    const shift = await prisma.cashShift.findFirst({
      where: { id: shiftId, gym_id: gymId },
      select: { id: true, user_id: true, opened_at: true, closed_at: true, status: true },
    });
    if (!shift) {
      res.status(404).json({ error: 'Turno no encontrado.' });
      return;
    }

    const sales = await prisma.sale.findMany({
      where: { gym_id: gymId, cash_shift_id: shift.id },
      include: {
        items: { include: { product: { select: { name: true } } } },
        seller: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    res.status(200).json({
      data: sales.map((s) => ({
        id: s.id,
        receipt_folio: s.receipt_folio,
        total: Number(s.total),
        created_at: s.created_at,
        seller: s.seller ? { id: s.seller.id, name: s.seller.name } : null,
        items: s.items.map((i) => ({
          product_name: i.product.name,
          quantity: i.quantity,
          price: Number(i.price),
          line_total: Number(i.price) * i.quantity,
        })),
      })),
      shift: {
        id: shift.id,
        opened_at: shift.opened_at,
        closed_at: shift.closed_at,
        status: shift.status,
      },
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getShiftSales Error]', 'Failed to retrieve shift sales.');
  }
};