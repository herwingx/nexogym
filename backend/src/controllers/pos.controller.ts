import { Request, Response } from 'express';
import { prisma } from '../db';
import { Role, ShiftStatus, TransactionType, SubscriptionStatus } from '@prisma/client';
import { saleSchema, expenseSchema } from '../schemas/pos.schema';
import { promoSaleSchema } from '../schemas/promotion.schema';
import { handleControllerError } from '../utils/http';
import { getNextSaleFolio } from '../utils/receipt-folio';
import { sendSaleReceiptEmail } from '../services/n8n.service';
import { PLAN_BARCODE_DAYS } from '../data/default-products';
import { logAuditEvent } from '../utils/audit.logger';

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
      const sellerIdForTx = sellerId || actorId;
      const inventoryTxData: { gym_id: string; product_id: string; user_id: string | null; type: TransactionType; quantity: number; reason: string }[] = [];

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
          user_id: sellerIdForTx ?? null,
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

// GET /pos/shifts?page=1&limit=20 — Admin ve todos; staff con can_use_pos solo sus propios cortes
export const getShifts = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const userId = req.user?.id;
    const userRole = req.userRole;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPERADMIN;
    const { page = '1', limit = '20', from_date, to_date, user_id: filterUserId } = req.query;

    const fromDate = typeof from_date === 'string' && from_date ? new Date(from_date + 'T00:00:00.000Z') : null;
    const toDate = typeof to_date === 'string' && to_date ? new Date(to_date + 'T23:59:59.999Z') : null;
    const dateFilter =
      fromDate && toDate
        ? { closed_at: { gte: fromDate, lte: toDate } }
        : fromDate
          ? { closed_at: { gte: fromDate } }
          : toDate
            ? { closed_at: { lte: toDate } }
            : {};

    const where = {
      gym_id: gymId,
      status: ShiftStatus.CLOSED,
      ...(!isAdmin && userId ? { user_id: userId } : {}),
      ...(isAdmin && filterUserId ? { user_id: String(filterUserId) } : {}),
      ...dateFilter,
    };
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [shifts, total] = await Promise.all([
      prisma.cashShift.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { closed_at: 'desc' },
        take,
        skip,
      }),
      prisma.cashShift.count({ where }),
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

// GET /pos/shifts/:id/sales — Admin: ventas (transacciones) de un corte + movimientos de inventario del turno
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

    // Staff con can_use_pos solo ve el detalle de sus propios turnos; Admin ve cualquiera
    const userId = req.user?.id;
    const userRole = req.userRole;
    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPERADMIN;
    if (!isAdmin && shift.user_id !== userId) {
      res.status(403).json({ error: 'Solo puedes ver el detalle de tus propios cortes.' });
      return;
    }

    const shiftEnd = shift.closed_at ?? new Date();

    const [sales, inventoryMovements] = await Promise.all([
      prisma.sale.findMany({
        where: { gym_id: gymId, cash_shift_id: shift.id },
        include: {
          items: { include: { product: { select: { name: true } } } },
          seller: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'asc' },
      }),
      prisma.inventoryTransaction.findMany({
        where: {
          gym_id: gymId,
          user_id: shift.user_id,
          type: { in: ['RESTOCK', 'LOSS'] },
          created_at: { gte: shift.opened_at, lte: shiftEnd },
        },
        include: {
          product: { select: { name: true } },
          user: { select: { name: true } },
        },
        orderBy: { created_at: 'asc' },
      }),
    ]);

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
      inventory_movements: inventoryMovements.map((m) => ({
        id: m.id,
        type: m.type,
        product_name: m.product.name,
        quantity: m.quantity,
        reason: m.reason,
        created_at: m.created_at,
        user_name: m.user?.name ?? null,
      })),
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getShiftSales Error]', 'Failed to retrieve shift sales.');
  }
};

/**
 * POST /pos/sales/promotion
 * Venta con promoción. Integra en Sale/SaleItem, turno, folio. Crea/actualiza Subscriptions para PLAN_*.
 */
export const createPromoSale = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const actorId = req.user?.id;
    if (!gymId || !actorId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const validation = promoSaleSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const { promotion_id, participant_ids, seller_id } = validation.data;
    const sellerIdForSale = seller_id || actorId;

    const promotion = await prisma.promotion.findFirst({
      where: { id: promotion_id, gym_id: gymId, active: true },
    });
    if (!promotion) {
      res.status(400).json({ error: 'Promoción no encontrada o inactiva.' });
      return;
    }

    const planTypes = ['PLAN_INDIVIDUAL', 'PLAN_PAREJA', 'PLAN_FAMILIAR'] as const;
    const requiresParticipants = planTypes.includes(promotion.type as (typeof planTypes)[number]);
    const n = participant_ids.length;

    if (requiresParticipants) {
      if (n < promotion.min_members || n > promotion.max_members) {
        res.status(400).json({
          error: `Esta promoción requiere entre ${promotion.min_members} y ${promotion.max_members} participantes.`,
        });
        return;
      }
    }

    const openShift = await prisma.cashShift.findFirst({
      where: { gym_id: gymId, user_id: actorId, status: ShiftStatus.OPEN },
    });
    if (!openShift) {
      res.status(400).json({ error: 'No hay turno de caja abierto. Abre un turno antes de cobrar.' });
      return;
    }

    const product = await prisma.product.findFirst({
      where: { gym_id: gymId, barcode: promotion.base_product_barcode, deleted_at: null },
    });
    if (!product) {
      res.status(400).json({
        error: `Falta el producto "${promotion.base_product_barcode}" en Inventario. Asigna precio y asegúrate de que exista.`,
      });
      return;
    }

    let price: number;
    if (promotion.pricing_mode === 'FIXED') {
      price = Number(promotion.fixed_price ?? 0);
    } else {
      const basePrice = Number(product.price);
      const discount = (promotion.discount_percent ?? 0) / 100;
      const unitPrice = basePrice * (1 - discount);
      const multiplier = requiresParticipants ? Math.max(n, 1) : 1;
      price = Math.round(unitPrice * multiplier * 100) / 100;
    }

    if (price <= 0) {
      res.status(400).json({
        error: 'El precio calculado es 0. Configura fixed_price o el precio del producto base en Inventario.',
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const receiptFolio = await getNextSaleFolio(gymId, tx as Pick<typeof prisma, '$queryRaw'>);

      const sale = await tx.sale.create({
        data: {
          gym_id: gymId,
          cash_shift_id: openShift.id,
          seller_id: sellerIdForSale,
          total: price,
          receipt_folio: receiptFolio,
          items: {
            create: [
              {
                gym_id: gymId,
                product_id: product.id,
                quantity: 1,
                price,
              },
            ],
          },
        },
        include: { items: { include: { product: { select: { name: true } } } } },
      });

      const days = promotion.days ?? PLAN_BARCODE_DAYS[promotion.base_product_barcode] ?? 30;
      const now = new Date();
      const newExpiresAt = new Date(now);
      newExpiresAt.setDate(newExpiresAt.getDate() + days);

      if (requiresParticipants && participant_ids.length > 0) {
        const participants = await tx.user.findMany({
          where: {
            id: { in: participant_ids },
            gym_id: gymId,
            role: 'MEMBER',
            deleted_at: null,
          },
        });

        if (participants.length !== participant_ids.length) {
          throw new Error('Algunos participantes no fueron encontrados en este gym.');
        }

        for (const user of participants) {
          const currentSub = await tx.subscription.findFirst({
            where: { user_id: user.id, gym_id: gymId },
            orderBy: { created_at: 'desc' },
          });

          const isStillActive =
            currentSub?.status === SubscriptionStatus.ACTIVE && currentSub.expires_at > now;
          const baseDate = isStillActive ? currentSub.expires_at : now;
          const expiresAt = new Date(baseDate);
          expiresAt.setDate(expiresAt.getDate() + days);

          if (currentSub) {
            await tx.subscription.update({
              where: { id: currentSub.id },
              data: {
                status: SubscriptionStatus.ACTIVE,
                expires_at: expiresAt,
                plan_barcode: promotion.base_product_barcode,
                promotion_id: promotion.id,
                ...((currentSub.status === SubscriptionStatus.FROZEN || !isStillActive) && {
                  frozen_days_left: null,
                }),
              },
            });
          } else {
            await tx.subscription.create({
              data: {
                gym_id: gymId,
                user_id: user.id,
                status: SubscriptionStatus.ACTIVE,
                expires_at: expiresAt,
                plan_barcode: promotion.base_product_barcode,
                promotion_id: promotion.id,
              },
            });
          }
        }
      }

      return sale;
    });

    await logAuditEvent(gymId, actorId, 'PROMO_SALE', {
      promotion_id: promotion.id,
      sale_id: result.id,
      receipt_folio: result.receipt_folio,
      amount: price,
      participant_count: participant_ids.length,
    });

    res.status(201).json({
      message: 'Venta con promoción registrada.',
      sale: result,
    });
  } catch (error: unknown) {
    const err = error as Error;
    req.log?.error({ err }, '[createPromoSale Error]');
    res.status(400).json({ error: err.message || 'Failed to complete promo sale.' });
  }
};