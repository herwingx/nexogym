import { Navigate, Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { logout } from '../../lib/logout'

export const MemberRoute = () => {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const qrAccess = useAuthStore((s) => s.modulesConfig.qr_access)

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== 'MEMBER') {
    return (
      <div className="flex items-center justify-center min-h-screen text-zinc-500 text-sm">
        Acceso restringido.
      </div>
    )
  }

  // Plan BASIC: el portal de socios (QR, premios, historial) no está habilitado
  if (!qrAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
        <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/80 px-6 py-8 backdrop-blur-md shadow-soft max-w-md text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Tu gimnasio está en plan <strong>Basic</strong>. El portal de socios (QR, premios, historial) no está disponible. Solo el administrador puede gestionar socios.
          </p>
          <button
            type="button"
            onClick={() => logout().then(() => window.location.replace('/login'))}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-white/10 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
