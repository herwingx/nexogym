import { create } from 'zustand'

export type Role = 'SUPERADMIN' | 'ADMIN' | 'RECEPTIONIST' | 'MEMBER'

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
  isBootstrapped: boolean
  /**
   * Mock de contexto de autenticación.
   * En F2 se conectará al endpoint /users/me/context.
   */
  setAuthContext: (payload: {
    user: AuthUser
    token: string
    modulesConfig: ModulesConfig
    tenantTheme: TenantTheme
  }) => void
  clearAuth: () => void
  /** Marca que ya se comprobó la sesión (restore al cargar). Sin sesión → redirect login. */
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
  isBootstrapped: false,
  setAuthContext: ({ user, token, modulesConfig, tenantTheme }) =>
    set({
      user,
      token,
      modulesConfig,
      tenantTheme,
      isBootstrapped: true,
    }),
  clearAuth: () =>
    set({
      user: null,
      token: null,
      modulesConfig: defaultModulesConfig,
      tenantTheme: defaultTenantTheme,
      isBootstrapped: false,
    }),
  setBootstrapped: (value) => set({ isBootstrapped: value }),
}))

