import { Outlet, Link, useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { logout } from '../lib/logout'

export const SuperAdminLayout = () => {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const handleLogout = () => {
    logout().then(() => navigate('/login', { replace: true }))
  }

  if (!user) return null

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col">
      <header className="shrink-0 border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/saas"
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 truncate"
            >
              NexoGym
            </Link>
            <Breadcrumb className="py-0" compact />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle size="sm" />
            <Link
              to="/saas/profile"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
              title="Mi perfil"
            >
              <User className="h-3.5 w-3.5" />
              Perfil
            </Link>
            <span className="hidden sm:inline text-xs text-zinc-500 dark:text-zinc-400">
              {user.name}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
