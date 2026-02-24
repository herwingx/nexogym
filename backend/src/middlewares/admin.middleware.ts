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