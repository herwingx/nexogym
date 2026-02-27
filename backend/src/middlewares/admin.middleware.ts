import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export const requireAdminOrSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || (req.userRole !== Role.ADMIN && req.userRole !== Role.SUPERADMIN)) {
    res.status(403).json({
      error: 'Forbidden: Admin or SuperAdmin access required.',
    });
    return;
  }

  next();
};

/** Admin, Receptionist o SuperAdmin. Para alta de socios, editar datos, listar/buscar (recepción puede cuando admin no está). */
export const requireStaff = (req: Request, res: Response, next: NextFunction) => {
  if (
    !req.user ||
    (req.userRole !== Role.ADMIN &&
      req.userRole !== Role.RECEPTIONIST &&
      req.userRole !== Role.SUPERADMIN)
  ) {
    res.status(403).json({
      error: 'Forbidden: Staff (Admin or Receptionist) access required.',
    });
    return;
  }

  next();
};

/** Admin, SuperAdmin, Coach o Instructor. Para rutinas y marcado de asistencia a clases (sin POS ni finanzas). */
export const requireCoachOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (
    !req.user ||
    (req.userRole !== Role.ADMIN &&
      req.userRole !== Role.SUPERADMIN &&
      req.userRole !== Role.COACH &&
      req.userRole !== Role.INSTRUCTOR)
  ) {
    res.status(403).json({
      error: 'Forbidden: Coach, Instructor, Admin or SuperAdmin access required.',
    });
    return;
  }

  next();
};

/** Permiso efectivo: puede usar POS/ventas e inventario (Admin/SuperAdmin o staff con can_use_pos). */
export const requireCanUsePos = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden: Authentication required.' });
    return;
  }
  if (req.userRole === Role.ADMIN || req.userRole === Role.SUPERADMIN) {
    next();
    return;
  }
  if (req.effectiveStaffPermissions?.can_use_pos) {
    next();
    return;
  }
  res.status(403).json({
    error: 'Forbidden: No tienes permiso para usar ventas/inventario. El admin puede activarlo en Personal.',
  });
};

/** Permiso efectivo: puede usar Clases y Rutinas (Admin/SuperAdmin o staff con can_use_routines). */
export const requireCanUseRoutines = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden: Authentication required.' });
    return;
  }
  if (req.userRole === Role.ADMIN || req.userRole === Role.SUPERADMIN) {
    next();
    return;
  }
  if (req.effectiveStaffPermissions?.can_use_routines) {
    next();
    return;
  }
  res.status(403).json({
    error: 'Forbidden: No tienes permiso para gestionar clases/rutinas. El admin puede activarlo en Personal.',
  });
};

/** Permiso efectivo: puede usar recepción/check-in (Admin/SuperAdmin o staff con can_use_reception). */
export const requireCanUseReception = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden: Authentication required.' });
    return;
  }
  if (req.userRole === Role.ADMIN || req.userRole === Role.SUPERADMIN) {
    next();
    return;
  }
  if (req.effectiveStaffPermissions?.can_use_reception) {
    next();
    return;
  }
  res.status(403).json({
    error: 'Forbidden: No tienes permiso para recepción/check-in. El admin puede activarlo en Personal.',
  });
};

/** GET /users: listado de socios requiere can_view_members; listado de staff requiere can_manage_staff. */
export const requireCanListUsers = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden: Authentication required.' });
    return;
  }
  if (req.userRole === Role.ADMIN || req.userRole === Role.SUPERADMIN) {
    next();
    return;
  }
  const roleNot = req.query.role_not as string | undefined;
  const isStaffList = roleNot === 'MEMBER' || String(roleNot || '').toUpperCase() === 'MEMBER';
  if (isStaffList) {
    if (req.effectiveStaffPermissions?.can_manage_staff) {
      next();
      return;
    }
    res.status(403).json({ error: 'Forbidden: No tienes permiso para ver personal.' });
    return;
  }
  if (req.effectiveStaffPermissions?.can_use_reception || req.effectiveStaffPermissions?.can_view_members_admin) {
    next();
    return;
  }
  res.status(403).json({ error: 'Forbidden: No tienes permiso para ver socios.' });
};

/** Puede ver/editar socios (recepción o panel admin socios). Staff puede ver y editar; eliminar es solo Admin. */
export const requireCanViewMembers = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden: Authentication required.' });
    return;
  }
  if (req.userRole === Role.ADMIN || req.userRole === Role.SUPERADMIN) {
    next();
    return;
  }
  if (req.effectiveStaffPermissions?.can_use_reception || req.effectiveStaffPermissions?.can_view_members_admin) {
    next();
    return;
  }
  res.status(403).json({
    error: 'Forbidden: No tienes permiso para ver/editar socios. El admin puede activarlo en Personal.',
  });
};

/** Puede ver ocupación/aforo (dashboard O recepción). Usado en Check-in y Dashboard. */
export const requireCanViewOccupancy = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden: Authentication required.' });
    return;
  }
  if (req.userRole === Role.ADMIN || req.userRole === Role.SUPERADMIN || req.userRole === Role.RECEPTIONIST) {
    next();
    return;
  }
  if (req.effectiveStaffPermissions?.can_view_dashboard || req.effectiveStaffPermissions?.can_use_reception) {
    next();
    return;
  }
  res.status(403).json({
    error: 'Forbidden: No tienes permiso para ver el aforo. El admin puede activar recepción o dashboard en Personal.',
  });
};

/** Permiso efectivo: puede ver dashboard. */
export const requireCanViewDashboard = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden: Authentication required.' });
    return;
  }
  if (req.userRole === Role.ADMIN || req.userRole === Role.SUPERADMIN) {
    next();
    return;
  }
  if (req.effectiveStaffPermissions?.can_view_dashboard) {
    next();
    return;
  }
  res.status(403).json({ error: 'Forbidden: No tienes permiso para ver el dashboard.' });
};

/** Puede ver datos financieros (dashboard o finanzas). */
export const requireCanViewFinanceData = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden: Authentication required.' });
    return;
  }
  if (req.userRole === Role.ADMIN || req.userRole === Role.SUPERADMIN) {
    next();
    return;
  }
  if (req.effectiveStaffPermissions?.can_use_finance || req.effectiveStaffPermissions?.can_view_dashboard) {
    next();
    return;
  }
  res.status(403).json({ error: 'Forbidden: No tienes permiso para ver finanzas.' });
};

/** Permiso efectivo: puede usar finanzas (ver reportes, ingresos). Edición limitada; eliminaciones solo Admin. */
export const requireCanUseFinance = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden: Authentication required.' });
    return;
  }
  if (req.userRole === Role.ADMIN || req.userRole === Role.SUPERADMIN) {
    next();
    return;
  }
  if (req.effectiveStaffPermissions?.can_use_finance) {
    next();
    return;
  }
  res.status(403).json({ error: 'Forbidden: No tienes permiso para finanzas.' });
};

/** Permiso efectivo: puede gestionar personal (ver, crear, editar permisos). Eliminar/dar de baja solo Admin. */
export const requireCanManageStaff = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden: Authentication required.' });
    return;
  }
  if (req.userRole === Role.ADMIN || req.userRole === Role.SUPERADMIN) {
    next();
    return;
  }
  if (req.effectiveStaffPermissions?.can_manage_staff) {
    next();
    return;
  }
  res.status(403).json({ error: 'Forbidden: No tienes permiso para gestionar personal.' });
};

/** Permiso efectivo: puede ver auditoría (solo lectura). */
export const requireCanViewAudit = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden: Authentication required.' });
    return;
  }
  if (req.userRole === Role.ADMIN || req.userRole === Role.SUPERADMIN) {
    next();
    return;
  }
  if (req.effectiveStaffPermissions?.can_view_audit) {
    next();
    return;
  }
  res.status(403).json({ error: 'Forbidden: No tienes permiso para ver auditoría.' });
};

/** Permiso efectivo: puede gestionar gamificación (premios, racha, apertura). */
export const requireCanUseGamification = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden: Authentication required.' });
    return;
  }
  if (req.userRole === Role.ADMIN || req.userRole === Role.SUPERADMIN) {
    next();
    return;
  }
  if (req.effectiveStaffPermissions?.can_use_gamification) {
    next();
    return;
  }
  res.status(403).json({ error: 'Forbidden: No tienes permiso para gamificación.' });
};

/** Permiso efectivo: puede ver leaderboard de rachas (Admin/SuperAdmin siempre; staff si can_view_leaderboard). */
export const requireCanViewLeaderboard = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden: Authentication required.' });
    return;
  }
  if (req.userRole === Role.ADMIN || req.userRole === Role.SUPERADMIN) {
    next();
    return;
  }
  if (req.effectiveStaffPermissions?.can_view_leaderboard) {
    next();
    return;
  }
  res.status(403).json({
    error: 'Forbidden: No tienes permiso para ver el leaderboard. El admin puede activarlo en Personal.',
  });
};