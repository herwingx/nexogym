import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import {
  LayoutDashboard,
  Users,
  UserCog,
  BarChart2,
  ShieldAlert,
  CalendarDays,
  Dumbbell,
  Package,
  Wallet,
  LogOut,
  User,
  Menu,
  X,
  Trophy,
  Medal,
  ScanQrCode,
} from 'lucide-react'
import { useAuthStore, type ModulesConfig } from '../store/useAuthStore'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { cn } from '../lib/utils'
import { logout } from '../lib/logout'

type ModuleKey = keyof ModulesConfig | null

type StaffPermissionKey = 'reception' | 'pos' | 'routines' | 'dashboard' | 'members_admin' | 'finance' | 'staff' | 'audit' | 'gamification' | 'leaderboard'

type NavItem = {
  label: string
  to: string
  icon: typeof LayoutDashboard
  moduleKey: ModuleKey
  adminOnly?: boolean
  staffPermission?: StaffPermissionKey
  /** Visible para todo el que accede al panel admin. */
  alwaysVisible?: boolean
}

const PERM_MAP: Record<StaffPermissionKey, keyof import('../store/useAuthStore').EffectiveStaffPermissions> = {
  reception: 'can_use_reception',
  pos: 'can_use_pos',
  routines: 'can_use_routines',
  dashboard: 'can_view_dashboard',
  members_admin: 'can_view_members_admin',
  finance: 'can_use_finance',
  staff: 'can_manage_staff',
  audit: 'can_view_audit',
  gamification: 'can_use_gamification',
  leaderboard: 'can_view_leaderboard',
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, moduleKey: null, staffPermission: 'dashboard' },
  { label: 'Check-in', to: '/reception', icon: ScanQrCode, moduleKey: null, staffPermission: 'reception' },
  { label: 'Socios', to: '/admin/members', icon: Users, moduleKey: null, staffPermission: 'members_admin' },
  { label: 'Finanzas', to: '/admin/finance', icon: BarChart2, moduleKey: null, staffPermission: 'finance' },
  { label: 'Inventario', to: '/admin/inventory', icon: Package, moduleKey: 'pos', staffPermission: 'pos' },
  { label: 'Cortes de caja', to: '/admin/shifts', icon: Wallet, moduleKey: 'pos', staffPermission: 'pos' },
  { label: 'Personal', to: '/admin/staff', icon: UserCog, moduleKey: null, staffPermission: 'staff' },
  { label: 'Clases', to: '/admin/classes', icon: CalendarDays, moduleKey: 'classes', staffPermission: 'routines' },
  { label: 'Rutinas', to: '/admin/routines', icon: Dumbbell, moduleKey: 'classes', staffPermission: 'routines' },
  { label: 'Gamificación', to: '/admin/rewards', icon: Trophy, moduleKey: 'gamification', staffPermission: 'gamification' },
  { label: 'Leaderboard', to: '/admin/leaderboard', icon: Medal, moduleKey: 'gamification', staffPermission: 'leaderboard' },
  { label: 'Auditoría', to: '/admin/audit', icon: ShieldAlert, moduleKey: null, staffPermission: 'audit' },
  { label: 'Mi perfil', to: '/admin/profile', icon: User, moduleKey: null, alwaysVisible: true },
]

export const AdminLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const gymName = useAuthStore((state) => state.gymName)
  const gymLogoUrl = useAuthStore((state) => state.gymLogoUrl)
  const modules = useAuthStore((state) => state.modulesConfig)
  const brandName = gymName ?? 'NexoGym'

  const closeMobileMenu = () => setMobileMenuOpen(false)

  const handleLogout = () => {
    logout().then(() => navigate('/login', { replace: true }))
  }

  if (!user) return null

  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN'
  const perms = user.effective_staff_permissions

  const filteredNav = navItems.filter((item) => {
    if (item.moduleKey && !modules[item.moduleKey]) return false
    if (isAdmin || item.alwaysVisible) return true
    if (!item.staffPermission) return false
    if (!perms) return false
    const key = PERM_MAP[item.staffPermission]
    return key ? (perms[key] === true) : false
  })

  return (
    <div className="h-screen flex overflow-hidden bg-background text-foreground">
      {/* Sidebar: fijo a la altura de la ventana; solo el nav hace scroll si hay muchas opciones */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col h-full border-r border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl">
        <div className="shrink-0 h-14 flex items-center px-4 border-b border-zinc-200 dark:border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            {gymLogoUrl ? (
              <div className="shrink-0 h-9 w-9 rounded-lg border border-zinc-200/80 dark:border-white/10 flex items-center justify-center overflow-hidden bg-white dark:bg-zinc-900">
                <img
                  src={gymLogoUrl}
                  alt=""
                  className="h-full w-full object-contain p-0.5"
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 truncate leading-tight">
                {brandName}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-medium">
                {user.role === 'ADMIN' ? 'Panel Admin' : user.role === 'COACH' || user.role === 'INSTRUCTOR' ? 'Clases y Rutinas' : user.role}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-0.5">
          {filteredNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800/70',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="shrink-0 px-4 py-3 border-t border-zinc-200 dark:border-white/10 space-y-2">
          <p className="text-xs text-zinc-500 truncate min-w-0">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {user.name}
            </span>
          </p>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors w-full"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {/* Mobile topbar con menú hamburguesa */}
        <div className="shrink-0 md:hidden px-4 py-3 border-b border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            {gymLogoUrl ? (
              <div className="shrink-0 h-8 w-8 rounded-lg border border-zinc-200/80 dark:border-white/10 flex items-center justify-center overflow-hidden bg-white dark:bg-zinc-900">
                <img src={gymLogoUrl} alt="" className="h-full w-full object-contain p-0.5" />
              </div>
            ) : null}
            <div className="min-w-0 space-y-0.5">
              <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 truncate leading-tight">{brandName}</div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-medium hidden sm:block">
                {user.role === 'ADMIN' ? 'Panel Admin' : user.role === 'COACH' || user.role === 'INSTRUCTOR' ? 'Clases y Rutinas' : user.role}
              </div>
            </div>
          </div>
          <ThemeToggle size="sm" className="shrink-0" />
        </div>

        {/* Drawer móvil */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            <div
              className="absolute inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm"
              onClick={closeMobileMenu}
              aria-hidden
            />
            <aside
              className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] flex flex-col border-r border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-200 dark:border-white/10">
                <div className="min-w-0 flex items-center gap-3">
                  {gymLogoUrl ? (
                    <div className="shrink-0 h-8 w-8 rounded-lg border border-zinc-200/80 dark:border-white/10 flex items-center justify-center overflow-hidden bg-white dark:bg-zinc-900">
                      <img src={gymLogoUrl} alt="" className="h-full w-full object-contain p-0.5" />
                    </div>
                  ) : null}
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate leading-tight">{brandName}</div>
                    <div className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-medium">
                      {user.role === 'ADMIN' ? 'Panel Admin' : user.role === 'COACH' || user.role === 'INSTRUCTOR' ? 'Clases y Rutinas' : user.role}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  aria-label="Cerrar menú"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
                {filteredNav.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/admin'}
                      onClick={closeMobileMenu}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium'
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800/70',
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
              </nav>
              <div className="px-4 py-3 border-t border-zinc-200 dark:border-white/10 space-y-2">
                <p className="text-xs text-zinc-500 truncate min-w-0">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{user.name}</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu()
                    handleLogout()
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors w-full"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Cerrar sesión
                </button>
              </div>
            </aside>
          </div>
        )}
        <div className="shrink-0 h-14 flex items-center justify-between w-full border-b border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 pl-4 pr-4 gap-3">
          <Breadcrumb className="flex-1 min-w-0 py-0" compact />
          <ThemeToggle size="sm" className="shrink-0 hidden md:inline-flex" />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
