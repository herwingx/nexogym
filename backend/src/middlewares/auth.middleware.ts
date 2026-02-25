import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { supabase } from '../lib/supabase';
import { prisma } from '../db';

const ACTIVE_STATUS = 'ACTIVE';

/** Tenant Guard (capa 2): rechaza si el gym está SUSPENDED o CANCELLED. SUPERADMIN exento. */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1]?.trim();
    if (!token) {
      res.status(401).json({ error: 'Unauthorized: Invalid authorization header' });
      return;
    }

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
      return;
    }

    const supabaseUserId = data.user.id;

    // Fetch internal user and gym status in one go
    const user = await prisma.user.findFirst({
      where: {
        deleted_at: null,
        OR: [{ id: supabaseUserId }, { auth_user_id: supabaseUserId }],
      },
      select: { id: true, gym_id: true, role: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized: User not found in database' });
      return;
    }

    // Tenant Guard: if not SUPERADMIN, ensure gym is ACTIVE (not SUSPENDED/CANCELLED)
    if (user.role !== Role.SUPERADMIN) {
      const gym = await prisma.gym.findUnique({
        where: { id: user.gym_id },
        select: { status: true, deleted_at: true },
      });
      if (!gym || gym.deleted_at != null || gym.status !== ACTIVE_STATUS) {
        res.status(403).json({ error: 'El acceso a este gimnasio está suspendido.' });
        return;
      }
    }

    // Attach to Request
    req.user = { ...data.user, id: user.id };
    req.authUserId = supabaseUserId;
    req.gymId = user.gym_id;
    req.userRole = user.role;

    next();
  } catch (err) {
    req.log?.error({ err }, '[Auth Middleware Error]');
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};
