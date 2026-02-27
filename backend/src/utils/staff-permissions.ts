import { Role } from '@prisma/client';

export type StaffPermissionsOverrides = {
  can_use_pos?: boolean;
  can_use_routines?: boolean;
  can_use_reception?: boolean;
  can_view_dashboard?: boolean;
  can_view_members_admin?: boolean;
  can_use_finance?: boolean;
  can_manage_staff?: boolean;
  can_view_audit?: boolean;
  can_use_gamification?: boolean;
  can_view_leaderboard?: boolean;
  can_view_member_qr?: boolean;
  can_regenerate_member_qr?: boolean;
};

export type EffectiveStaffPermissions = {
  can_use_pos: boolean;
  can_use_routines: boolean;
  can_use_reception: boolean;
  can_view_dashboard: boolean;
  can_view_members_admin: boolean;
  can_use_finance: boolean;
  can_manage_staff: boolean;
  can_view_audit: boolean;
  can_use_gamification: boolean;
  can_view_leaderboard: boolean;
  can_view_member_qr: boolean;
  can_regenerate_member_qr: boolean;
};

const DEFAULTS_BY_ROLE: Record<Role, EffectiveStaffPermissions> = {
  [Role.SUPERADMIN]: {
    can_use_pos: true,
    can_use_routines: true,
    can_use_reception: true,
    can_view_dashboard: true,
    can_view_members_admin: true,
    can_use_finance: true,
    can_manage_staff: true,
    can_view_audit: true,
    can_use_gamification: true,
    can_view_leaderboard: true,
    can_view_member_qr: true,
    can_regenerate_member_qr: true,
  },
  [Role.ADMIN]: {
    can_use_pos: true,
    can_use_routines: true,
    can_use_reception: true,
    can_view_dashboard: true,
    can_view_members_admin: true,
    can_use_finance: true,
    can_manage_staff: true,
    can_view_audit: true,
    can_use_gamification: true,
    can_view_leaderboard: true,
    can_view_member_qr: true,
    can_regenerate_member_qr: true,
  },
  [Role.RECEPTIONIST]: {
    can_use_pos: true,
    can_use_routines: false,
    can_use_reception: true,
    can_view_dashboard: false,
    can_view_members_admin: false,
    can_use_finance: false,
    can_manage_staff: false,
    can_view_audit: false,
    can_use_gamification: false,
    can_view_leaderboard: false,
    can_view_member_qr: false,
    can_regenerate_member_qr: false,
  },
  [Role.COACH]: {
    can_use_pos: false,
    can_use_routines: true,
    can_use_reception: false,
    can_view_dashboard: false,
    can_view_members_admin: false,
    can_use_finance: false,
    can_manage_staff: false,
    can_view_audit: false,
    can_use_gamification: false,
    can_view_leaderboard: false,
    can_view_member_qr: false,
    can_regenerate_member_qr: false,
  },
  [Role.INSTRUCTOR]: {
    can_use_pos: false,
    can_use_routines: true,
    can_use_reception: false,
    can_view_dashboard: false,
    can_view_members_admin: false,
    can_use_finance: false,
    can_manage_staff: false,
    can_view_audit: false,
    can_use_gamification: false,
    can_view_leaderboard: false,
    can_view_member_qr: false,
    can_regenerate_member_qr: false,
  },
  [Role.CLEANER]: {
    can_use_pos: false,
    can_use_routines: false,
    can_use_reception: false,
    can_view_dashboard: false,
    can_view_members_admin: false,
    can_use_finance: false,
    can_manage_staff: false,
    can_view_audit: false,
    can_use_gamification: false,
    can_view_leaderboard: false,
    can_view_member_qr: false,
    can_regenerate_member_qr: false,
  },
  [Role.MEMBER]: {
    can_use_pos: false,
    can_use_routines: false,
    can_use_reception: false,
    can_view_dashboard: false,
    can_view_members_admin: false,
    can_use_finance: false,
    can_manage_staff: false,
    can_view_audit: false,
    can_use_gamification: false,
    can_view_leaderboard: false,
    can_view_member_qr: false,
    can_regenerate_member_qr: false,
  },
};

function parseOverrides(raw: unknown): StaffPermissionsOverrides | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: StaffPermissionsOverrides = {};
  const keys: (keyof StaffPermissionsOverrides)[] = [
    'can_use_pos',
    'can_use_routines',
    'can_use_reception',
    'can_view_dashboard',
    'can_view_members_admin',
    'can_use_finance',
    'can_manage_staff',
    'can_view_audit',
    'can_use_gamification',
    'can_view_leaderboard',
    'can_view_member_qr',
    'can_regenerate_member_qr',
  ];
  for (const k of keys) {
    if (typeof o[k] === 'boolean') out[k] = o[k];
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Computes effective staff permissions from role and optional overrides (staff_permissions JSON).
 * Staff can view/edit where permitted; delete/destructive actions stay admin-only (requieren requireAdminOrSuperAdmin).
 */
export function getEffectiveStaffPermissions(
  role: Role,
  staffPermissionsJson: unknown,
): EffectiveStaffPermissions {
  const defaults = DEFAULTS_BY_ROLE[role] ?? DEFAULTS_BY_ROLE[Role.MEMBER];
  const overrides = parseOverrides(staffPermissionsJson);
  if (!overrides) return defaults;
  return {
    can_use_pos: overrides.can_use_pos ?? defaults.can_use_pos,
    can_use_routines: overrides.can_use_routines ?? defaults.can_use_routines,
    can_use_reception: overrides.can_use_reception ?? defaults.can_use_reception,
    can_view_dashboard: overrides.can_view_dashboard ?? defaults.can_view_dashboard,
    can_view_members_admin: overrides.can_view_members_admin ?? defaults.can_view_members_admin,
    can_use_finance: overrides.can_use_finance ?? defaults.can_use_finance,
    can_manage_staff: overrides.can_manage_staff ?? defaults.can_manage_staff,
    can_view_audit: overrides.can_view_audit ?? defaults.can_view_audit,
    can_use_gamification: overrides.can_use_gamification ?? defaults.can_use_gamification,
    can_view_leaderboard: overrides.can_view_leaderboard ?? defaults.can_view_leaderboard,
    can_view_member_qr: overrides.can_view_member_qr ?? defaults.can_view_member_qr,
    can_regenerate_member_qr: overrides.can_regenerate_member_qr ?? defaults.can_regenerate_member_qr,
  };
}
