import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  getLiveOccupancy,
  getDailyRevenue,
  getFinancialReport,
  getAuditLogs,
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
router.get('/occupancy', getLiveOccupancy);           // Semáforo en tiempo real (90 min)

/**
 * @swagger
 * /api/v1/analytics/revenue/daily:
 *   get:
 *     summary: Get today's total revenue
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Today's revenue breakdown
 */
router.get('/revenue/daily', getDailyRevenue);        // Ingresos del día

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
 */
router.get('/financial-report', getFinancialReport);  // Reporte mensual: ventas - egresos

/**
 * @swagger
 * /api/v1/analytics/audit-logs:
 *   get:
 *     summary: Get gym audit logs (anti-fraud)
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: List of audit log entries
 */
router.get('/audit-logs', getAuditLogs);              // Historial anti-fraudes

export default router;
