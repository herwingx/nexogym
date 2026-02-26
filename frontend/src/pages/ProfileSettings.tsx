import { type FormEvent, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { notifyError, notifySuccess } from '../lib/notifications'
import { getRouteConfig } from '../config/routes.config'

const BACK_LABELS: Record<string, string> = {
  '/saas': 'Volver al dashboard',
  '/admin': 'Volver al panel',
  '/reception': 'Volver a recepción',
  '/member': 'Volver al inicio',
}

export const ProfileSettings = () => {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const config = getRouteConfig(pathname)
  const backTo = config?.parent ?? '/'
  const backLabel = BACK_LABELS[backTo] ?? 'Volver'
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      notifyError({
        title: 'Contraseña corta',
        description: 'Usa al menos 8 caracteres.',
      })
      return
    }
    if (newPassword !== newPasswordConfirm) {
      notifyError({
        title: 'No coinciden',
        description: 'La contraseña y la confirmación deben ser iguales.',
      })
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setNewPasswordConfirm('')
      notifySuccess({
        title: 'Contraseña actualizada',
        description: 'Tu contraseña se ha cambiado correctamente.',
      })
    } catch (err) {
      notifyError({
        title: 'No se pudo cambiar la contraseña',
        description: (err as Error)?.message ?? 'Inténtalo de nuevo.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-4 transition-colors"
        title={backLabel}
      >
        <ChevronLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
        Mi perfil
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        Gestiona tu cuenta y cambia tu contraseña.
      </p>

      <div className="space-y-6">
        <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Información de sesión
          </h2>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-500">Nombre</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {user?.name ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-500">Correo</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {user?.email ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-500">Rol</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {user?.role ?? '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
            Cambiar contraseña
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Nueva contraseña"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              minLength={8}
            />
            <Input
              label="Confirmar contraseña"
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              placeholder="Repite la contraseña"
              autoComplete="new-password"
              minLength={8}
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar contraseña'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
