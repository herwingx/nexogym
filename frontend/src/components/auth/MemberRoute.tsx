import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'

export const MemberRoute = () => {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)

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

  return <Outlet />
}
