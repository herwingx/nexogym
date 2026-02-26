import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Home, Trophy, History, LogOut, User } from 'lucide-react'
import { cn } from '../lib/utils'
import { logout } from '../lib/logout'

const navItems = [
  { label: 'Inicio', to: '/member', icon: Home },
  { label: 'Premios', to: '/member/rewards', icon: Trophy },
  { label: 'Historial', to: '/member/history', icon: History },
  { label: 'Perfil', to: '/member/profile', icon: User },
]

export const MemberLayout = () => {
  const navigate = useNavigate()

  const handleLogout = () => {
    logout().then(() => navigate('/login', { replace: true }))
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Barra superior con Salir */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          NexoGym
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="h-3.5 w-3.5" />
          Salir
        </button>
      </header>
      <main className="flex-1 overflow-y-auto pb-24 flex flex-col">
        <div className="border-b border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 shrink-0">
          <Breadcrumb compact />
        </div>
        <Outlet />
      </main>

      {/* Bottom Navigation Bar — glassmorphism, light/dark */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl pb-safe">
        <div className="flex items-center justify-around px-2 py-2 max-w-md mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/member'}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors min-w-[4rem]',
                    isActive
                      ? 'text-primary'
                      : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'h-5 w-5',
                        isActive ? 'text-primary' : 'text-zinc-400',
                      )}
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
