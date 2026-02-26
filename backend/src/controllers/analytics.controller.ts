import { Request, Response } from 'express';
import { prisma } from '../db';
import { handleControllerError } from '../utils/http';

// GET /analytics/occupancy
export const getLiveOccupancy = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const now = new Date();
    const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000);

    const activeVisitsCount = await prisma.visit.count({
      where: {
        gym_id: gymId,
        check_in_time: {
          gte: ninetyMinutesAgo,
        },
      },
    });

    let status = 'VACÍO';
    if (activeVisitsCount > 0 && activeVisitsCount <= 20) {
      status = 'NORMAL';
    } else if (activeVisitsCount > 20) {
      status = 'LLENO';
    }

    res.status(200).json({
      activeUsers: activeVisitsCount,
      current_count: activeVisitsCount,
      capacity: 0, // 0 = sin límite (el front muestra ∞)
      status,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getLiveOccupancy Error]', 'Failed to retrieve occupancy data.');
  }
};

// GET /analytics/revenue/daily?date=YYYY-MM-DD
export const getDailyRevenue = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const dateParam = req.query.date as string | undefined;
    let targetDate: string;

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      targetDate = dateParam;
    } else {
      targetDate = new Date().toISOString().split('T')[0];
    }

    const todayStart = new Date(`${targetDate}T00:00:00.000Z`);
    const todayEnd = new Date(`${targetDate}T23:59:59.999Z`);

    const dailySales = await prisma.sale.aggregate({
      where: {
        gym_id: gymId,
        created_at: { gte: todayStart, lte: todayEnd },
      },
      _sum: { total: true },
      _count: { id: true },
    });

    const totalRevenue = Number(dailySales._sum.total || 0);

    res.status(200).json({
      date: targetDate,
      revenue: totalRevenue,
      sale_count: dailySales._count.id,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getDailyRevenue Error]', 'Failed to retrieve revenue data.');
  }
};

/**
 * GET /analytics/financial-report?month=YYYY-MM
 * Reporte financiero mensual para el dueño del negocio.
 * Fórmula: Ventas POS + Membresías Renovadas - Egresos = Ganancia Neta
 */
export const getFinancialReport = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    // Default to current month if not specified
    const monthParam = req.query.month as string | undefined;
    let periodStart: Date;
    let periodEnd: Date;

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [year, month] = monthParam.split('-').map(Number);
      periodStart = new Date(year, month - 1, 1);
      periodEnd = new Date(year, month, 1);
    } else {
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    const periodFilter = { gte: periodStart, lt: periodEnd };

    // 1. POS sales revenue
    const salesAgg = await prisma.sale.aggregate({
      where: { gym_id: gymId, created_at: periodFilter },
      _sum: { total: true },
      _count: { id: true },
    });
    const totalSales = Number(salesAgg._sum.total || 0);

    // 2. Memberships renewed in this period (count * assumed value or sum from a payment model)
    //    For now, count active subscriptions created/updated in period as proxy
    const renewedSubs = await prisma.subscription.count({
      where: { gym_id: gymId, created_at: periodFilter },
    });

    // 3. Total expenses
    const expensesAgg = await prisma.expense.aggregate({
      where: { gym_id: gymId, created_at: periodFilter },
      _sum: { amount: true },
      _count: { id: true },
    });
    const totalExpenses = Number(expensesAgg._sum.amount || 0);

    // 4. Inventory losses for the period
    const lossAgg = await prisma.inventoryTransaction.count({
      where: { gym_id: gymId, type: 'LOSS', created_at: periodFilter },
    });

    const netProfit = totalSales - totalExpenses;

    res.status(200).json({
      period: {
        start: periodStart.toISOString().split('T')[0],
        end: new Date(periodEnd.getTime() - 1).toISOString().split('T')[0],
      },
      income: {
        pos_sales: totalSales,
        sale_count: salesAgg._count.id,
        memberships_created: renewedSubs,
      },
      expenses: {
        total: totalExpenses,
        expense_count: expensesAgg._count.id,
      },
      inventory: {
        loss_transactions: lossAgg,
      },
      net_profit: netProfit,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getFinancialReport Error]', 'Failed to generate financial report.');
  }
};

/**
 * GET /analytics/audit-logs?action=COURTESY_ACCESS_GRANTED&limit=50
 * Historial de auditoría para el dueño. Detecta:
 *  - Recepcionistas regalando accesos de cortesía
 *  - "Mermas" fraudulentas de inventario
 *  - Cortes de caja con descuadre
 */
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { action, userId: filterUserId, limit = '50', page = '1' } = req.query;

    const take = Math.min(Number(limit) || 50, 200); // Cap at 200 per page
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const logs = await prisma.auditLog.findMany({
      where: {
        gym_id: gymId,
        ...(action ? { action: String(action) } : {}),
        ...(filterUserId ? { user_id: String(filterUserId) } : {}),
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { created_at: 'desc' },
      take,
      skip,
    });

    const total = await prisma.auditLog.count({
      where: {
        gym_id: gymId,
        ...(action ? { action: String(action) } : {}),
        ...(filterUserId ? { user_id: String(filterUserId) } : {}),
      },
    });

    res.status(200).json({
      data: logs,
      meta: { total, page: Number(page), limit: take },
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getAuditLogs Error]', 'Failed to retrieve audit logs.');
  }
};

/**
 * GET /analytics/commissions?month=YYYY-MM
 * Reporte de ventas agrupadas por vendedor (staff) para pago de comisiones.
 * Módulo 11 — Control de Staff y Comisiones.
 */
export const getCommissions = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const monthParam = req.query.month as string | undefined;
    let periodStart: Date;
    let periodEnd: Date;

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [year, month] = monthParam.split('-').map(Number);
      periodStart = new Date(year, month - 1, 1);
      periodEnd = new Date(year, month, 1);
    } else {
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    const salesBySeller = await prisma.sale.groupBy({
      by: ['seller_id'],
      where: {
        gym_id: gymId,
        seller_id: { not: null },
        created_at: { gte: periodStart, lt: periodEnd },
      },
      _sum: { total: true },
      _count: { id: true },
    });

    // Enrich with seller names
    const sellerIds = salesBySeller
      .map((s) => s.seller_id)
      .filter((id): id is string => id !== null);

    const sellers = await prisma.user.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, name: true, role: true },
    });

    const sellersMap = new Map(sellers.map((s) => [s.id, s]));

    const report = salesBySeller.map((row) => ({
      seller: sellersMap.get(row.seller_id!) ?? { id: row.seller_id, name: 'Unknown', role: null },
      total_sales: Number(row._sum.total || 0),
      sale_count: row._count.id,
    }));

    report.sort((a, b) => b.total_sales - a.total_sales);

    res.status(200).json({
      period: {
        start: periodStart.toISOString().split('T')[0],
        end: new Date(periodEnd.getTime() - 1).toISOString().split('T')[0],
      },
      data: report,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getCommissions Error]', 'Failed to retrieve commission report.');
  }
};
