import { Request, Response } from 'express';
import { prisma } from '../db';
import { ShiftStatus } from '@prisma/client';
import { sendShiftSummary } from '../services/n8n.service';
import { logAuditEvent } from '../utils/audit.logger';

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

    res.status(201).json({
      message: 'Shift opened successfully.',
      shift,
    });
  } catch (error: any) {
    console.error('[openShift Error]:', error);
    res.status(500).json({ error: 'Failed to open shift.' });
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
    // Opening Balance + Sales made during this shift (from opened_at to now)
    const salesDuringShift = await prisma.sale.aggregate({
      where: {
        gym_id: gymId,
        created_at: {
          gte: currentShift.opened_at,
          lte: now,
        },
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
      sendShiftSummary(gymOwner.phone, {
        openedAt: currentShift.opened_at,
        closedAt: now,
        openingBalance: Number(currentShift.opening_balance),
        totalSales,
        expectedBalance: expected_balance,
        actualBalance: Number(actual_balance),
        difference,
      }).catch(console.error);
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
    console.error('[closeShift Error]:', error);
    res.status(500).json({ error: 'Failed to close shift.' });
  }
};
