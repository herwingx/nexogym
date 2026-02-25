import { create } from 'zustand'

export type Role = 'SUPERADMIN' | 'ADMIN' | 'RECEPTIONIST' | 'COACH' | 'INSTRUCTOR' | 'MEMBER'

export type ModulesConfig = {
  pos: boolean
  classes: boolean
  analytics: boolean
  crm: boolean
  portal: boolean
}

export type TenantTheme = {
  /**
   * Hex color provisto por el backend para el gimnasio actual.
   * Ejemplo: #2563eb
   */
  primaryHex: string
}

export type AuthUser = {
  id: string
  name: string
  email: string
  role: Role
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
  isBootstrapped: boolean
  setAuthContext: (payload: {
    user: AuthUser
    token: string
    modulesConfig: ModulesConfig
    tenantTheme: TenantTheme
    gymName?: string | null
    gymLogoUrl?: string | null
  }) => void
  clearAuth: () => void
  setBootstrapped: (value: boolean) => void
}

const defaultModulesConfig: ModulesConfig = {
  pos: false,
  classes: false,
  analytics: false,
  crm: false,
  portal: false,
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
  isBootstrapped: false,
  setAuthContext: ({ user, token, modulesConfig, tenantTheme, gymName, gymLogoUrl }) =>
    set({
      user,
      token,
      modulesConfig,
      tenantTheme,
      gymName: gymName ?? null,
      gymLogoUrl: gymLogoUrl ?? null,
      isBootstrapped: true,
    }),
  clearAuth: () =>
    set({
      user: null,
      token: null,
      modulesConfig: defaultModulesConfig,
      tenantTheme: defaultTenantTheme,
      gymName: null,
      gymLogoUrl: null,
      isBootstrapped: false,
    }),
  setBootstrapped: (value) => set({ isBootstrapped: value }),
}))

