import { create } from 'zustand'

export type Role = 'SUPERADMIN' | 'ADMIN' | 'RECEPTIONIST' | 'COACH' | 'INSTRUCTOR' | 'MEMBER'

export type ModulesConfig = {
  pos: boolean
  classes: boolean
  analytics: boolean
  crm: boolean
  portal: boolean
  /** Portal de socios (QR, premios, historial). En BASIC es false; miembros no tienen acceso. */
  qr_access: boolean
  /** Premios por racha (gamificación). Solo en planes no BASIC. */
  gamification: boolean
}

export type TenantTheme = {
  /**
   * Hex color provisto por el backend para el gimnasio actual.
   * Ejemplo: #2563eb
   */
  primaryHex: string
}

export type EffectiveStaffPermissions = {
  can_use_pos: boolean
  can_use_routines: boolean
  can_use_reception: boolean
  can_view_dashboard?: boolean
  can_view_members_admin?: boolean
  can_use_finance?: boolean
  can_manage_staff?: boolean
  can_view_audit?: boolean
  can_use_gamification?: boolean
  can_view_leaderboard?: boolean
}

export type AuthUser = {
  id: string
  name: string
  email: string
  role: Role
  effective_staff_permissions?: EffectiveStaffPermissions
}

export type AuthState = {
  user: AuthUser | null
  token: string | null
  modulesConfig: ModulesConfig
  tenantTheme: TenantTheme
  /** White-label: nombre del gym (users/me/context). */
  gymName: string | null
  /** White-label: logo URL del gym (users/me/context). */
  gymLogoUrl: string | null
  /** Si el usuario debe cambiar contraseña en primer login. */
  mustChangePassword: boolean
  isBootstrapped: boolean
  setTenantTheme: (theme: TenantTheme) => void
  setGymLogoUrl: (url: string | null) => void
  setAuthContext: (payload: {
    user: AuthUser
    token: string
    modulesConfig: ModulesConfig
    tenantTheme: TenantTheme
    gymName?: string | null
    gymLogoUrl?: string | null
    mustChangePassword?: boolean
  }) => void
  setMustChangePassword: (value: boolean) => void
  clearAuth: () => void
  setBootstrapped: (value: boolean) => void
}

const defaultModulesConfig: ModulesConfig = {
  pos: false,
  classes: false,
  analytics: false,
  crm: false,
  portal: false,
  qr_access: false,
  gamification: false,
}

const defaultTenantTheme: TenantTheme = {
  primaryHex: '#2563eb',
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  modulesConfig: defaultModulesConfig,
  tenantTheme: defaultTenantTheme,
  gymName: null,
  gymLogoUrl: null,
  mustChangePassword: false,
  isBootstrapped: false,
  setTenantTheme: (theme) => set({ tenantTheme: theme }),
  setGymLogoUrl: (url) => set({ gymLogoUrl: url }),
  setAuthContext: ({ user, token, modulesConfig, tenantTheme, gymName, gymLogoUrl, mustChangePassword }) =>
    set({
      user,
      token,
      modulesConfig,
      tenantTheme,
      gymName: gymName ?? null,
      gymLogoUrl: gymLogoUrl ?? null,
      mustChangePassword: mustChangePassword ?? false,
      isBootstrapped: true,
    }),
  setMustChangePassword: (value) => set({ mustChangePassword: value }),
  clearAuth: () =>
    set({
      user: null,
      token: null,
      modulesConfig: defaultModulesConfig,
      tenantTheme: defaultTenantTheme,
      gymName: null,
      gymLogoUrl: null,
      mustChangePassword: false,
      isBootstrapped: false,
    }),
  setBootstrapped: (value) => set({ isBootstrapped: value }),
}))

