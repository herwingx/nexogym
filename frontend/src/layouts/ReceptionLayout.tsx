import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { CreditCard, ScanQrCode, UserPlus, Users, LogOut, Wallet, User, LayoutDashboard, Medal, CalendarDays, Dumbbell, Menu, X, ClipboardList } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { cn } from '../lib/utils'
import { logout } from '../lib/logout'
import { fetchCurrentShift } from '../lib/apiClient'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'

const navItems: { label: string; to: string; icon: typeof ScanQrCode; moduleKey?: 'pos' | 'gamification' | 'classes'; staffPermission?: 'leaderboard' | 'routines' }[] = [
  { label: 'Check-in', to: '/reception', icon: ScanQrCode },
  { label: 'Visitas', to: '/reception/visits', icon: ClipboardList },
  { label: 'POS', to: '/reception/pos', icon: CreditCard, moduleKey: 'pos' },
  { label: 'Socios', to: '/reception/members', icon: Users },
  { label: 'Alta', to: '/reception/members/new', icon: UserPlus },
  { label: 'Clases', to: '/reception/classes', icon: CalendarDays, moduleKey: 'classes', staffPermission: 'routines' },
  { label: 'Rutinas', to: '/reception/routines', icon: Dumbbell, moduleKey: 'classes', staffPermission: 'routines' },
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
  const [navMenuOpen, setNavMenuOpen] = useState(false)

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
    if (item.staffPermission === 'routines') {
      if (isAdminOrSuperAdmin) return true
      return perms?.can_use_routines === true
    }
    return true
  })

  return (
    <div className="h-screen flex overflow-hidden bg-background text-foreground">
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="border-b border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 px-4 py-3 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {(isAdminOrSuperAdmin || perms?.can_view_dashboard) && (
              <NavLink
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors shrink-0 touch-manipulation"
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
            <p className="text-xs text-zinc-500 hidden sm:block truncate">
              Flujo hardware-first para check-in y POS.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle size="sm" />
            <NavLink
              to="/reception/profile"
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-2.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:py-1.5 text-xs transition-colors touch-manipulation',
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
            <div className="hidden sm:inline-flex rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-1 text-xs text-zinc-500">
              Sesión:{' '}
              <span className="ml-1 font-medium text-zinc-700 dark:text-zinc-300">
                {user.name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={logoutChecking}
              className="inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors disabled:opacity-50 touch-manipulation"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>
        </header>

        {/* Breadcrumb y tabs */}
        <div className="border-b border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 flex items-center justify-between gap-3">
          <Breadcrumb compact />
          {/* Hamburguesa: visible en móvil/tablet, oculto en desktop */}
          <button
            type="button"
            onClick={() => setNavMenuOpen(true)}
            className="lg:hidden inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors touch-manipulation"
            aria-label="Abrir menú de navegación"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        {/* Tabs horizontales: solo en desktop (lg+) */}
        <nav className="hidden lg:flex border-b border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 px-2 py-1.5 gap-1">
          {filteredNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/reception' || item.to === '/reception/members' || item.to === '/reception/leaderboard'}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800/70',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Drawer de navegación para móvil/tablet */}
        {navMenuOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            <div
              className="absolute inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm"
              onClick={() => setNavMenuOpen(false)}
              aria-hidden
            />
            <aside
              className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] flex flex-col border-l border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-200 dark:border-white/10">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Navegación</span>
                <button
                  type="button"
                  onClick={() => setNavMenuOpen(false)}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors touch-manipulation"
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
                      end={item.to === '/reception' || item.to === '/reception/members' || item.to === '/reception/leaderboard'}
                      onClick={() => setNavMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-md px-3 py-3 text-sm transition-colors min-h-[44px] touch-manipulation',
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
            </aside>
          </div>
        )}

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
