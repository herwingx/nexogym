import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  getLiveOccupancy,
  getDailyRevenue,
  getFinancialReport,
  getAuditLogs,
} from '../controllers/analytics.controller';

const router = Router();

// Todas las rutas analíticas requieren Auth (solo ADMIN / SUPERADMIN en producción)
router.use(requireAuth);

// SPRINT B8: Dashboard y Auditoría
router.get('/occupancy', getLiveOccupancy);           // Semáforo en tiempo real (90 min)
router.get('/revenue/daily', getDailyRevenue);        // Ingresos del día
router.get('/financial-report', getFinancialReport);  // Reporte mensual: ventas - egresos
router.get('/audit-logs', getAuditLogs);              // Historial anti-fraudes

export default router;
