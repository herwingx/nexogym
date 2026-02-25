import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  BarChart2,
  ShieldAlert,
  CalendarDays,
  Dumbbell,
  Package,
  Wallet,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { cn } from '../lib/utils'
import { logout } from '../lib/logout'

type Modules = ReturnType<typeof useAuthStore>['modulesConfig']
type ModuleKey = keyof Modules | null

type NavItem = {
  label: string
  to: string
  icon: typeof LayoutDashboard
  moduleKey: ModuleKey
}

// moduleKey null = siempre visible para admin. pos/classes = según modules_config del backend (plan del gym).
const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, moduleKey: null },
  { label: 'Socios', to: '/admin/members', icon: Users, moduleKey: null },
  { label: 'Finanzas', to: '/admin/finance', icon: BarChart2, moduleKey: null },
  { label: 'Inventario', to: '/admin/inventory', icon: Package, moduleKey: 'pos' },
  { label: 'Cortes de caja', to: '/admin/shifts', icon: Wallet, moduleKey: 'pos' },
  { label: 'Clases', to: '/admin/classes', icon: CalendarDays, moduleKey: 'classes' },
  { label: 'Rutinas', to: '/admin/routines', icon: Dumbbell, moduleKey: 'classes' },
  { label: 'Auditoría', to: '/admin/audit', icon: ShieldAlert, moduleKey: null },
]

export const AdminLayout = () => {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const modules = useAuthStore((state) => state.modulesConfig)

  const handleLogout = () => {
    logout().then(() => navigate('/login', { replace: true }))
  }

  if (!user) return null

  const filteredNav = navItems.filter((item) =>
    item.moduleKey ? modules[item.moduleKey] : true,
  )

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10">
          <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            NexoGym
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {user.role === 'ADMIN' ? 'Panel Admin' : user.role}
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

      <main className="flex-1 min-w-0">
        {/* Mobile topbar */}
        <div className="md:hidden px-4 py-3 border-b border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl">
          <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            NexoGym
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">Panel Admin</div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
