import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  requireCanViewDashboard,
  requireCanUseFinance,
  requireCanViewFinanceData,
  requireCanViewAudit,
} from '../middlewares/admin.middleware';
import {
  getLiveOccupancy,
  getDailyRevenue,
  getFinancialReport,
  getAuditLogs,
  getCommissions,
} from '../controllers/analytics.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Dashboards, financial reports and audit logs
 */

// Todas las rutas analíticas requieren Auth (solo ADMIN / SUPERADMIN en producción)
router.use(requireAuth);

/**
 * @swagger
 * /api/v1/analytics/occupancy:
 *   get:
 *     summary: Get live gym occupancy (last 90 minutes)
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Current occupancy count
 */
router.get('/occupancy', requireCanViewDashboard, getLiveOccupancy);

/**
 * @swagger
 * /api/v1/analytics/revenue/daily:
 *   get:
 *     summary: Get revenue for a specific day (defaults to today)
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           example: '2026-02-24'
 *         description: Target date in YYYY-MM-DD format
 *     responses:
 *       200:
 *         description: Revenue and sale count for the target date
 */
router.get('/revenue/daily', requireCanViewFinanceData, getDailyRevenue);

/**
 * @swagger
 * /api/v1/analytics/financial-report:
 *   get:
 *     summary: Get monthly financial report
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: number
 *       - in: query
 *         name: year
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Financial report (sales - expenses)
 *       403:
 *         description: Forbidden (Admin only)
 */
router.get('/financial-report', requireCanViewFinanceData, getFinancialReport);

/**
 * @swagger
 * /api/v1/analytics/audit-logs:
 *   get:
 *     summary: Get gym audit logs (anti-fraud)
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: List of audit log entries
 *       403:
 *         description: Forbidden (Admin only)
 */
router.get('/audit-logs', requireCanViewAudit, getAuditLogs);

/**
 * @swagger
 * /api/v1/analytics/commissions:
 *   get:
 *     summary: Sales grouped by seller/staff for commissions (Module 11)
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           example: '2026-02'
 *         description: Target month in YYYY-MM format (defaults to current month)
 *     responses:
 *       200:
 *         description: Commission report sorted by total sales descending
 *       403:
 *         description: Forbidden (Admin only)
 */
router.get('/commissions', requireCanUseFinance, getCommissions);

export default router;
