import { Role } from '@prisma/client';

export type EffectiveStaffPermissions = {
  can_use_pos: boolean;
  can_use_routines: boolean;
  can_use_reception: boolean;
};

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      gymId?: string;
      userRole?: Role;
      authUserId?: string;
      user?: any; // The raw Supabase user if needed
      /** Effective staff permissions (role defaults + staff_permissions overrides). Set by auth middleware. */
      effectiveStaffPermissions?: {
        can_use_pos: boolean;
        can_use_routines: boolean;
        can_use_reception: boolean;
        can_view_dashboard?: boolean;
        can_view_members_admin?: boolean;
        can_use_finance?: boolean;
        can_manage_staff?: boolean;
        can_view_audit?: boolean;
        can_use_gamification?: boolean;
      };
    }
  }
}
