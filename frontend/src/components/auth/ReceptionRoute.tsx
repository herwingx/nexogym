import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'

export const ReceptionRoute = () => {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (
    user.role !== 'RECEPTIONIST' &&
    user.role !== 'ADMIN' &&
    user.role !== 'SUPERADMIN'
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-6 py-4 backdrop-blur-md shadow-soft max-w-md text-center">
          <p className="text-sm text-zinc-300">
            Esta sección está disponible solo para usuarios con rol{' '}
            <span className="font-semibold">RECEPTIONIST</span>,{' '}
            <span className="font-semibold">ADMIN</span> o{' '}
            <span className="font-semibold">SUPERADMIN</span>.
          </p>
        </div>
      </div>
    )
  }

  return <Outlet />
}

