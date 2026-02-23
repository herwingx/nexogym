import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.userRole !== Role.SUPERADMIN) {
    res.status(403).json({
      error: 'Forbidden: SuperAdmin access required.',
    });
    return;
  }

  next();
};
