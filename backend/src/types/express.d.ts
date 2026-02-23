import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      gymId?: string;
      userRole?: Role;
      user?: any; // The raw Supabase user if needed
    }
  }
}
