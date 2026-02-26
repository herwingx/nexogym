import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import { CardSkeleton, Skeleton } from '../ui/Skeleton'

/** Skeleton según la ruta actual para que la espera del bootstrap se sienta coherente con la pantalla que va a abrir. */
function BootstrapSkeleton() {
  const { pathname } = useLocation()

  if (pathname.startsWith('/member')) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 pt-10 pb-6">
        <div className="max-w-md mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-36" />
            </div>
            <Skeleton className="h-11 w-11 rounded-full shrink-0" />
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900 p-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-5 flex flex-col items-center gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-52 w-52 rounded-2xl" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
    )
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/reception')) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CardSkeleton count={3} lines={2} />
          </section>
        </div>
      </div>
    )
  }

  if (pathname.startsWith('/saas')) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8">
        <div className="w-full max-w-5xl mx-auto space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CardSkeleton count={3} lines={2} />
          </section>
          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-5 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
            <div className="space-y-2 pt-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="space-y-3 flex flex-col items-center">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}

export interface ProtectedRouteProps {
  /** Ruta interna a la que redirigir si no hay sesión. No usar valor de la URL sin validar con getSafeRedirectTo. */
  redirectTo?: string
}

import { MustChangePasswordModal } from './MustChangePasswordModal'

export const ProtectedRoute = ({ redirectTo = '/login' }: ProtectedRouteProps) => {
  const { user, token, isBootstrapped, mustChangePassword } = useAuthStore()
  // redirectTo viene solo de props (valor fijo); si en el futuro se lee de searchParams, usar getSafeRedirectTo()
  const safeRedirect = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/login'

  if (!isBootstrapped) {
    return <BootstrapSkeleton />
  }

  if (!token || !user) {
    return <Navigate to={safeRedirect} replace />
  }

  return (
    <>
      <Outlet />
      {mustChangePassword && <MustChangePasswordModal />}
    </>
  )
}

