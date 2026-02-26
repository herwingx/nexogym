import { type FormEvent, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/useAuthStore'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { notifyError, notifySuccess } from '../../lib/notifications'

/**
 * Modal bloqueante para forzar cambio de contraseña en primer login.
 * Se muestra cuando el usuario tiene user_metadata.must_change_password.
 */
export const MustChangePasswordModal = () => {
  const setMustChangePassword = useAuthStore((s) => s.setMustChangePassword)
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
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      })
      if (error) throw error
      setMustChangePassword(false)
      setNewPassword('')
      setNewPasswordConfirm('')
      notifySuccess({
        title: 'Contraseña actualizada',
        description: 'Ya puedes usar la aplicación con normalidad.',
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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/30 dark:bg-black/70 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="must-change-password-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 shadow-xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1 mb-4">
          <h2 id="must-change-password-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Cambia tu contraseña
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Por seguridad, debes establecer una nueva contraseña antes de continuar.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nueva contraseña"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            placeholder="Repite la contraseña"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <Button type="submit" className="w-full" isLoading={submitting}>
            Guardar y continuar
          </Button>
        </form>
      </div>
    </div>
  )
}
