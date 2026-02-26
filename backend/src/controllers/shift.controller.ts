import { Request, Response } from 'express';
import { prisma } from '../db';
import { Role, ShiftStatus } from '@prisma/client';
import { sendShiftSummary } from '../services/n8n.service';
import { logAuditEvent } from '../utils/audit.logger';
import { handleControllerError } from '../utils/http';

// POST /shifts/open
export const openShift = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const userId = req.user?.id; // Assuming req.user contains the authenticated SuperAdmin/Receptionist ID

    if (!gymId || !userId) {
      res.status(401).json({ error: 'Unauthorized: Context missing' });
      return;
    }

    const { opening_balance } = req.body;

    if (opening_balance === undefined) {
      res.status(400).json({ error: 'opening_balance is required.' });
      return;
    }

    // Check if there is already an open shift for this user/gym
    const existingShift = await prisma.cashShift.findFirst({
      where: {
        gym_id: gymId,
        user_id: userId,
        status: ShiftStatus.OPEN,
      },
    });

    if (existingShift) {
      res.status(400).json({ error: 'You already have an open shift.' });
      return;
    }

    const shift = await prisma.cashShift.create({
      data: {
        gym_id: gymId,
        user_id: userId,
        opening_balance,
        status: ShiftStatus.OPEN,
      },
    });

    await logAuditEvent(gymId, userId, 'SHIFT_OPENED', {
      shift_id: shift.id,
      opening_balance: Number(opening_balance),
    });

    res.status(201).json({
      message: 'Shift opened successfully.',
      shift,
    });
  } catch (error: any) {
    handleControllerError(req, res, error, '[openShift Error]', 'Failed to open shift.');
  }
};

// POST /shifts/close
export const closeShift = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const userId = req.user?.id;

    if (!gymId || !userId) {
      res.status(401).json({ error: 'Unauthorized: Context missing' });
      return;
    }

    const { actual_balance } = req.body;

    if (actual_balance === undefined) {
      res.status(400).json({ error: 'actual_balance is required.' });
      return;
    }

    // Find the currently open shift
    const currentShift = await prisma.cashShift.findFirst({
      where: {
        gym_id: gymId,
        user_id: userId,
        status: ShiftStatus.OPEN,
      },
    });

    if (!currentShift) {
      res.status(404).json({ error: 'No open shift found to close.' });
      return;
    }

    const now = new Date();

    // Calculate total expected balance:
    // Sales are linked directly to this shift via cash_shift_id
    const salesDuringShift = await prisma.sale.aggregate({
      where: {
        gym_id: gymId,
        cash_shift_id: currentShift.id,
      },
      _sum: {
        total: true,
      },
    });

    const totalSales = Number(salesDuringShift._sum.total || 0);

    // Sum all expenses registered during this shift
    const expensesDuringShift = await prisma.expense.aggregate({
      where: { gym_id: gymId, cash_shift_id: currentShift.id },
      _sum: { amount: true },
    });
    const totalExpenses = Number(expensesDuringShift._sum.amount || 0);

    // Formula: Fondo Inicial + Ventas - Egresos = Saldo Esperado
    const expected_balance = Number(currentShift.opening_balance) + totalSales - totalExpenses;

    const updatedShift = await prisma.cashShift.update({
      where: { id: currentShift.id },
      data: {
        closed_at: now,
        status: ShiftStatus.CLOSED,
        expected_balance,
        actual_balance,
      },
    });

    const difference = Number(actual_balance) - expected_balance;

    // AuditLog: registrar cierre con diferencia para detectar descuadres
    await logAuditEvent(gymId, userId, 'SHIFT_CLOSED', {
      shift_id: currentShift.id,
      opening_balance: Number(currentShift.opening_balance),
      total_sales: totalSales,
      total_expenses: totalExpenses,
      expected_balance,
      actual_balance: Number(actual_balance),
      difference,
    });

    // Fire-and-forget: notify gym owner via n8n/WhatsApp with PDF summary
    const gymOwner = await prisma.user.findFirst({
      where: { gym_id: gymId, role: 'ADMIN' },
      select: { phone: true },
    });

    if (gymOwner?.phone) {
      sendShiftSummary(gymId, gymOwner.phone, {
        openedAt: currentShift.opened_at,
        closedAt: now,
        openingBalance: Number(currentShift.opening_balance),
        totalSales,
        expectedBalance: expected_balance,
        actualBalance: Number(actual_balance),
        difference,
      }).catch((err) => {
        req.log?.error({ err }, '[closeShift SummaryWebhook Error]');
      });
    }

    // Cierre ciego: RECEPTIONIST no recibe detalles de reconciliación (evitar trampas)
    const userRole = req.userRole as Role | undefined;
    if (userRole === Role.RECEPTIONIST) {
      res.status(200).json({ message: 'Turno cerrado exitosamente.' });
      return;
    }

    res.status(200).json({
      message: 'Shift closed successfully.',
      shift: updatedShift,
      reconciliation: {
        opening_balance: Number(currentShift.opening_balance),
        total_sales: totalSales,
        total_expenses: totalExpenses,
        expected: expected_balance,
        actual: Number(actual_balance),
        difference,
        status: difference === 0 ? 'BALANCED' : difference > 0 ? 'SURPLUS' : 'SHORTAGE',
      },
    });
  } catch (error: any) {
    handleControllerError(req, res, error, '[closeShift Error]', 'Failed to close shift.');
  }
};

/**
 * PATCH /pos/shifts/:id/force-close — Admin/SuperAdmin only.
 * Cierra forzosamente un turno abierto (ej. cajero abandonó sin corte).
 * Body: { actual_balance?: number } (default 0 si no se envía).
 */
export const forceCloseShift = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const actorId = req.user?.id;
    const shiftId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!gymId || !actorId || !shiftId) {
      res.status(401).json({ error: 'Unauthorized: Context missing' });
      return;
    }

    const actual_balance = typeof req.body?.actual_balance === 'number' ? req.body.actual_balance : 0;

    const currentShift = await prisma.cashShift.findFirst({
      where: { id: shiftId, gym_id: gymId, status: ShiftStatus.OPEN },
      include: { user: { select: { name: true } } },
    });

    if (!currentShift) {
      res.status(404).json({ error: 'Turno abierto no encontrado o ya cerrado.' });
      return;
    }

    const [salesAgg, expensesAgg] = await Promise.all([
      prisma.sale.aggregate({
        where: { gym_id: gymId, cash_shift_id: currentShift.id },
        _sum: { total: true },
      }),
      prisma.expense.aggregate({
        where: { gym_id: gymId, cash_shift_id: currentShift.id },
        _sum: { amount: true },
      }),
    ]);

    const totalSales = Number(salesAgg._sum.total || 0);
    const totalExpenses = Number(expensesAgg._sum.amount || 0);
    const expected_balance = Number(currentShift.opening_balance) + totalSales - totalExpenses;
    const now = new Date();

    const updatedShift = await prisma.cashShift.update({
      where: { id: currentShift.id },
      data: {
        closed_at: now,
        status: ShiftStatus.CLOSED,
        expected_balance,
        actual_balance,
      },
    });

    const difference = actual_balance - expected_balance;

    const openedByName = currentShift && 'user' in currentShift ? (currentShift as { user?: { name: string | null } }).user?.name : undefined;
    await logAuditEvent(gymId, actorId, 'SHIFT_FORCE_CLOSED', {
      shift_id: currentShift.id,
      opened_by: openedByName,
      opening_balance: Number(currentShift.opening_balance),
      total_sales: totalSales,
      total_expenses: totalExpenses,
      expected_balance,
      actual_balance,
      difference,
    });

    res.status(200).json({
      message: 'Turno cerrado forzosamente.',
      shift: updatedShift,
      reconciliation: {
        expected: expected_balance,
        actual: actual_balance,
        difference,
        status: difference === 0 ? 'BALANCED' : difference > 0 ? 'SURPLUS' : 'SHORTAGE',
      },
    });
  } catch (error: any) {
    handleControllerError(req, res, error, '[forceCloseShift Error]', 'Failed to force-close shift.');
  }
};

/**
 * Cierra todos los turnos abiertos de un gym (uso Super Admin, ej. antes de downgrade).
 * No requiere que el gym tenga módulo POS.
 */
export const closeAllOpenShiftsForGym = async (
  gymId: string,
  actorId: string,
): Promise<{ closed: number; shift_ids: string[] }> => {
  const openShifts = await prisma.cashShift.findMany({
    where: { gym_id: gymId, status: ShiftStatus.OPEN },
    include: { user: { select: { name: true } } },
  });

  const shiftIds: string[] = [];

  for (const currentShift of openShifts) {
    const [salesAgg, expensesAgg] = await Promise.all([
      prisma.sale.aggregate({
        where: { gym_id: gymId, cash_shift_id: currentShift.id },
        _sum: { total: true },
      }),
      prisma.expense.aggregate({
        where: { gym_id: gymId, cash_shift_id: currentShift.id },
        _sum: { amount: true },
      }),
    ]);

    const totalSales = Number(salesAgg._sum.total || 0);
    const totalExpenses = Number(expensesAgg._sum.amount || 0);
    const expected_balance = Number(currentShift.opening_balance) + totalSales - totalExpenses;
    const actual_balance = 0;

    await prisma.cashShift.update({
      where: { id: currentShift.id },
      data: {
        closed_at: new Date(),
        status: ShiftStatus.CLOSED,
        expected_balance,
        actual_balance,
      },
    });

    const openedByName = (currentShift as { user?: { name: string | null } }).user?.name;
    await logAuditEvent(gymId, actorId, 'SHIFT_FORCE_CLOSED', {
      shift_id: currentShift.id,
      opened_by: openedByName,
      opening_balance: Number(currentShift.opening_balance),
      total_sales: totalSales,
      total_expenses: totalExpenses,
      expected_balance,
      actual_balance,
      difference: actual_balance - expected_balance,
      source: 'saas_close_all_open_shifts',
    });

    shiftIds.push(currentShift.id);
  }

  return { closed: shiftIds.length, shift_ids: shiftIds };
};
