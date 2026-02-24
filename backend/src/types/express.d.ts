import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      gymId?: string;
      userRole?: Role;
      authUserId?: string;
      user?: any; // The raw Supabase user if needed
    }
  }
}
