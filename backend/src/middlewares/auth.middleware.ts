import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { prisma } from '../db';

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

    // Fetch internal user by either legacy id mapping or auth_user_id mapping
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

    // Attach to Request
    req.user = { ...data.user, id: user.id };
    req.authUserId = supabaseUserId;
    req.gymId = user.gym_id;
    req.userRole = user.role;

    next();
  } catch (err) {
    console.error('[Auth Middleware Error]:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};
