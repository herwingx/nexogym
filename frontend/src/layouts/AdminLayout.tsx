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
} from 'lucide-react'
import { useAuthStore, type ModulesConfig } from '../store/useAuthStore'
import { cn } from '../lib/utils'
import { logout } from '../lib/logout'

type ModuleKey = keyof ModulesConfig | null

type NavItem = {
  label: string
  to: string
  icon: typeof LayoutDashboard
  moduleKey: ModuleKey
  /** Si está definido, solo estos roles ven el ítem (ADMIN y SUPERADMIN siempre si no se filtra por coachOnly). */
  coachOrInstructorOnly?: boolean
}

// moduleKey null = siempre visible para admin. pos/classes = según modules_config del backend (plan del gym).
const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, moduleKey: null },
  { label: 'Socios', to: '/admin/members', icon: Users, moduleKey: null },
  { label: 'Finanzas', to: '/admin/finance', icon: BarChart2, moduleKey: null },
  { label: 'Inventario', to: '/admin/inventory', icon: Package, moduleKey: 'pos' },
  { label: 'Cortes de caja', to: '/admin/shifts', icon: Wallet, moduleKey: 'pos' },
  { label: 'Personal', to: '/admin/staff', icon: UserCog, moduleKey: null },
  { label: 'Clases', to: '/admin/classes', icon: CalendarDays, moduleKey: 'classes', coachOrInstructorOnly: true },
  { label: 'Rutinas', to: '/admin/routines', icon: Dumbbell, moduleKey: 'classes', coachOrInstructorOnly: true },
  { label: 'Auditoría', to: '/admin/audit', icon: ShieldAlert, moduleKey: null },
  { label: 'Mi perfil', to: '/admin/profile', icon: User, moduleKey: null },
]

export const AdminLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const modules = useAuthStore((state) => state.modulesConfig)

  const closeMobileMenu = () => setMobileMenuOpen(false)

  const handleLogout = () => {
    logout().then(() => navigate('/login', { replace: true }))
  }

  if (!user) return null

  const isCoachOrInstructor = user.role === 'COACH' || user.role === 'INSTRUCTOR'
  const filteredNav = navItems.filter((item) => {
    // Si el módulo no está habilitado en el plan, no mostrar el ítem
    if (item.moduleKey && !modules[item.moduleKey]) return false
    if (isCoachOrInstructor) return item.coachOrInstructorOnly === true
    if (item.coachOrInstructorOnly) return true
    return true
  })

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10">
          <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            NexoGym
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {user.role === 'ADMIN' ? 'Panel Admin' : user.role === 'COACH' || user.role === 'INSTRUCTOR' ? 'Clases y Rutinas' : user.role}
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
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

        <div className="px-4 py-3 border-t border-zinc-200 dark:border-white/10 space-y-2">
          <p className="text-xs text-zinc-500 truncate">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {user.name}
            </span>
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors w-full"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar con menú hamburguesa */}
        <div className="md:hidden px-4 py-3 border-b border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              NexoGym
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">Panel Admin</div>
          </div>
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
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">NexoGym</div>
                  <div className="text-xs text-zinc-500">Panel Admin</div>
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
                <p className="text-xs text-zinc-500 truncate">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{user.name}</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu()
                    handleLogout()
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors w-full"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Cerrar sesión
                </button>
              </div>
            </aside>
          </div>
        )}
        <div className="border-b border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95">
          <Breadcrumb />
        </div>
        <Outlet />
      </main>
    </div>
  )
}
