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

/** Admin, SuperAdmin o Coach. Para rutinas y marcado de asistencia a clases (sin POS ni finanzas). */
export const requireCoachOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (
    !req.user ||
    (req.userRole !== Role.ADMIN &&
      req.userRole !== Role.SUPERADMIN &&
      req.userRole !== Role.COACH)
  ) {
    res.status(403).json({
      error: 'Forbidden: Coach, Admin or SuperAdmin access required.',
    });
    return;
  }

  next();
};