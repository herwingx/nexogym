import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'

export const ReceptionRoute = () => {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const canReception =
    user.role === 'ADMIN' ||
    user.role === 'SUPERADMIN' ||
    user.role === 'RECEPTIONIST' ||
    user.effective_staff_permissions?.can_use_reception === true

  if (!canReception) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-6 py-4 backdrop-blur-md shadow-soft max-w-md text-center">
          <p className="text-sm text-zinc-300">
            No tienes permiso para recepción/check-in. El admin puede activarlo en Personal → Permisos.
          </p>
        </div>
      </div>
    )
  }

  return <Outlet />
}

