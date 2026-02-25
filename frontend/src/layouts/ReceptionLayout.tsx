import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CreditCard, ScanQrCode, UserPlus, Users, LogOut } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { cn } from '../lib/utils'
import { logout } from '../lib/logout'

const navItems = [
  { label: 'Check-in', to: '/reception', icon: ScanQrCode },
  { label: 'POS', to: '/reception/pos', icon: CreditCard },
  { label: 'Socios', to: '/reception/members', icon: Users },
  { label: 'Alta', to: '/reception/members/new', icon: UserPlus },
]

export const ReceptionLayout = () => {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const handleLogout = () => {
    logout().then(() => navigate('/login', { replace: true }))
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="border-b border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 px-4 py-3 backdrop-blur-md flex items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Recepción
            </h1>
            <p className="text-[11px] text-zinc-500">
              Flujo hardware-first para check-in y POS.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:inline-flex rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-1 text-[11px] text-zinc-500">
              Sesión:{' '}
              <span className="ml-1 font-medium text-zinc-700 dark:text-zinc-300">
                {user.name}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>
        </header>

        {/* Tabs de navegación */}
        <nav className="flex border-b border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 px-2 py-1.5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/reception'}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800/70',
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="flex-1 min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
