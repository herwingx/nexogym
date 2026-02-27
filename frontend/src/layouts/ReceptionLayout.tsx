import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { CreditCard, ScanQrCode, UserPlus, Users, LogOut, Wallet, User, LayoutDashboard, Medal } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { cn } from '../lib/utils'
import { logout } from '../lib/logout'
import { fetchCurrentShift } from '../lib/apiClient'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'

const navItems: { label: string; to: string; icon: typeof ScanQrCode; moduleKey?: 'pos' | 'gamification'; staffPermission?: 'leaderboard' }[] = [
  { label: 'Check-in', to: '/reception', icon: ScanQrCode },
  { label: 'POS', to: '/reception/pos', icon: CreditCard, moduleKey: 'pos' },
  { label: 'Socios', to: '/reception/members', icon: Users },
  { label: 'Alta', to: '/reception/members/new', icon: UserPlus },
  { label: 'Leaderboard', to: '/reception/leaderboard', icon: Medal, moduleKey: 'gamification', staffPermission: 'leaderboard' },
]

export const ReceptionLayout = () => {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const gymName = useAuthStore((state) => state.gymName)
  const gymLogoUrl = useAuthStore((state) => state.gymLogoUrl)
  const modules = useAuthStore((state) => state.modulesConfig)
  const [logoutBlockModal, setLogoutBlockModal] = useState(false)
  const [logoutChecking, setLogoutChecking] = useState(false)

  const handleLogout = async () => {
    setLogoutChecking(true)
    try {
      const shift = await fetchCurrentShift().catch(() => null)
      if (shift?.shift?.status === 'OPEN') {
        setLogoutBlockModal(true)
        return
      }
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setLogoutChecking(false)
    }
  }

  const goToCloseShift = () => {
    setLogoutBlockModal(false)
    navigate('/reception')
  }

  if (!user) return null
  const isAdminOrSuperAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN'
  const perms = user.effective_staff_permissions

  const filteredNav = navItems.filter((item) => {
    if (item.moduleKey && !modules[item.moduleKey]) return false
    if (item.staffPermission === 'leaderboard') {
      if (isAdminOrSuperAdmin) return true
      return perms?.can_view_leaderboard === true
    }
    return true
  })

  return (
    <div className="h-screen flex overflow-hidden bg-background text-foreground">
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="border-b border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 px-4 py-3 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {isAdminOrSuperAdmin && (
              <NavLink
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors shrink-0"
                title="Volver al panel de administración"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Panel admin</span>
              </NavLink>
            )}
            {gymLogoUrl ? (
              <img
                src={gymLogoUrl}
                alt={gymName ?? 'Gym'}
                className="h-8 w-auto object-contain flex-shrink-0"
              />
            ) : (
              <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                {gymName ?? 'Recepción'}
              </h1>
            )}
            <p className="text-[11px] text-zinc-500 hidden sm:block truncate">
              Flujo hardware-first para check-in y POS.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle size="sm" />
            <NavLink
              to="/reception/profile"
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] transition-colors',
                  isActive
                    ? 'text-primary font-medium bg-primary/10'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
                )
              }
              title="Mi perfil"
            >
              <User className="h-3.5 w-3.5" />
              Perfil
            </NavLink>
            <div className="hidden sm:inline-flex rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-1 text-[11px] text-zinc-500">
              Sesión:{' '}
              <span className="ml-1 font-medium text-zinc-700 dark:text-zinc-300">
                {user.name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={logoutChecking}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors disabled:opacity-50"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>
        </header>

        {/* Breadcrumb y tabs */}
        <div className="border-b border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95">
          <Breadcrumb compact />
        </div>
        <nav className="flex border-b border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 px-2 py-1.5 gap-1">
          {filteredNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/reception' || item.to === '/reception/members' || item.to === '/reception/leaderboard'}
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

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </div>
      </main>

      {logoutBlockModal && (
        <Modal isOpen title="Turno abierto" onClose={() => setLogoutBlockModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Tienes un turno de caja abierto. Debes hacer <strong>corte de caja</strong> antes de cerrar sesión para actualizar saldos y dejar el turno cerrado.
            </p>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setLogoutBlockModal(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={goToCloseShift} className="inline-flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                Ir a cerrar turno
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
