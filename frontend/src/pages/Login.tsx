import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/useAuthStore'
import { fetchUserContext } from '../lib/apiClient'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { notifyError, notifyPromise, notifySuccess } from '../lib/notifications'

export const LoginPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [showSetNewPassword, setShowSetNewPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const setAuthContext = useAuthStore((state) => state.setAuthContext)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const params = new URLSearchParams(hash)
    if (params.get('type') === 'recovery') {
      setShowSetNewPassword(true)
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email || !password) {
      notifyError({
        title: 'Campos incompletos',
        description: 'Ingresa tu email y contraseña.',
      })
      return
    }

    setIsSubmitting(true)

    try {
      await notifyPromise(
        (async () => {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (error || !data.session) {
            const err = error ?? new Error('Credenciales inválidas')
            // Ayuda específica para acceso SaaS: el usuario debe existir en Supabase (seed)
            const isInvalidCredentials =
              (err as { message?: string }).message?.includes('Invalid login credentials') ||
              (err as { name?: string }).name === 'AuthApiError'
            if (isInvalidCredentials) {
              throw new Error(
                'Credenciales inválidas. Para acceso SaaS (superadmin@nexogym.dev) ejecuta el seed del backend con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del mismo proyecto que usa el frontend (VITE_SUPABASE_URL).',
              )
            }
            throw err
          }

          const context = await fetchUserContext()

          const mustChange = (data.session.user?.user_metadata as { must_change_password?: boolean } | undefined)?.must_change_password === true
          setAuthContext({
            user: {
              id: context.user.id,
              name: context.user.name,
              email,
              role: context.user.role as any,
            },
            token: data.session.access_token,
            mustChangePassword: mustChange,
            modulesConfig: {
              pos: context.gym.modules_config.pos ?? false,
              classes: context.gym.modules_config.classes ?? false,
              analytics: context.gym.modules_config.analytics ?? false,
              crm: context.gym.modules_config.crm ?? false,
              portal: context.gym.modules_config.portal ?? false,
              qr_access: context.gym.modules_config.qr_access ?? false,
              gamification: context.gym.modules_config.gamification ?? false,
            },
            tenantTheme: {
              primaryHex: context.gym.theme_colors?.primary ?? '#2563eb',
            },
            gymName: context.gym.name ?? null,
            gymLogoUrl: context.gym.logo_url ?? null,
          })

          navigate('/', { replace: true })
          return { userName: context.user.name ?? email }
        })(),
        {
          loading: { title: 'Iniciando sesión...' },
          success: (data?: { userName: string }) => ({
            title: 'Bienvenido',
            description: data?.userName ? `Bienvenido, ${data.userName}.` : 'Sesión iniciada correctamente.',
          }),
          error: (err: unknown) => ({
            title: 'No pudimos iniciar sesión',
            description: (err as Error)?.message ?? 'Revisa tus credenciales e inténtalo de nuevo.',
          }),
        },
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      notifyError({ title: 'Email requerido', description: 'Ingresa tu correo para recuperar la contraseña.' })
      return
    }
    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      })
      if (error) throw error
      setResetEmailSent(true)
      notifySuccess({
        title: 'Correo enviado',
        description: 'Revisa tu bandeja y usa el enlace para restablecer tu contraseña.',
      })
    } catch (err) {
      notifyError({
        title: 'No se pudo enviar',
        description: (err as Error)?.message ?? 'Revisa el email e inténtalo de nuevo.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetNewPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      notifyError({ title: 'Contraseña corta', description: 'Usa al menos 8 caracteres.' })
      return
    }
    if (newPassword !== newPasswordConfirm) {
      notifyError({ title: 'No coinciden', description: 'La contraseña y la confirmación deben ser iguales.' })
      return
    }
    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      notifySuccess({ title: 'Contraseña actualizada', description: 'Ya puedes iniciar sesión con tu nueva contraseña.' })
      setShowSetNewPassword(false)
      setNewPassword('')
      setNewPasswordConfirm('')
    } catch (err) {
      notifyError({
        title: 'Error',
        description: (err as Error)?.message ?? 'No se pudo actualizar la contraseña.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4 sm:p-6 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-soft space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">NexoGym</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {showSetNewPassword
              ? 'Escribe tu nueva contraseña.'
              : showForgotPassword
                ? 'Te enviaremos un enlace para restablecer tu contraseña.'
                : 'Inicia sesión para administrar tu gimnasio.'}
          </p>
        </div>

        {showSetNewPassword ? (
          <form className="space-y-4" onSubmit={handleSetNewPasswordSubmit}>
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
            />
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Guardar contraseña
            </Button>
          </form>
        ) : showForgotPassword ? (
          resetEmailSent ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Revisa la bandeja de entrada de <strong>{email}</strong> y usa el enlace del correo para restablecer tu contraseña.
              </p>
              <button
                type="button"
                onClick={() => { setShowForgotPassword(false); setResetEmailSent(false) }}
                className="text-sm text-primary hover:underline"
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleForgotSubmit}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoComplete="email"
              />
              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                Enviar enlace de recuperación
              </Button>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Volver al inicio de sesión
              </button>
            </form>
          )
        ) : (
          <>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@gympro.com"
                autoComplete="email"
              />
              <Input
                label="Contraseña"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                Entrar
              </Button>
            </form>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </>
        )}
      </div>
    </div>
  )
}

