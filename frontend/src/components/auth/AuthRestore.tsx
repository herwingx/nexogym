import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { fetchUserContext } from '../../lib/apiClient'
import { useAuthStore } from '../../store/useAuthStore'

const BOOTSTRAP_TIMEOUT_MS = 8_000

/**
 * Al cargar la app, restaura la sesión desde Supabase (token persistido)
 * y vuelve a cargar el contexto del backend para rellenar el store.
 * Si no hay sesión o falla el contexto → bootstrap listo y se muestra login.
 * Si tarda más de BOOTSTRAP_TIMEOUT_MS → se corta y se redirige a login (evita quedar colgado).
 */
export const AuthRestore = ({ children }: { children: React.ReactNode }) => {
  const setAuthContext = useAuthStore((s) => s.setAuthContext)
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  useEffect(() => {
    let cancelled = false

    const timeoutId = setTimeout(() => {
      if (cancelled) return
      clearAuth()
      setBootstrapped(true)
    }, BOOTSTRAP_TIMEOUT_MS)

    const restore = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (cancelled) return

      if (sessionError || !session?.access_token) {
        clearTimeout(timeoutId)
        setBootstrapped(true)
        return
      }

      try {
        const context = await fetchUserContext()
        if (cancelled) return

        clearTimeout(timeoutId)
        setAuthContext({
          user: {
            id: context.user.id,
            name: context.user.name ?? '',
            email: session.user?.email ?? '',
            role: context.user.role as import('../../store/useAuthStore').Role,
          },
          token: session.access_token,
          modulesConfig: {
            pos: context.gym.modules_config?.pos ?? false,
            classes: context.gym.modules_config?.classes ?? false,
            analytics: context.gym.modules_config?.analytics ?? false,
            crm: context.gym.modules_config?.crm ?? false,
            portal: context.gym.modules_config?.portal ?? false,
          },
          tenantTheme: {
            primaryHex: (context.gym as { theme_colors?: { primary?: string } })?.theme_colors?.primary ?? '#2563eb',
          },
        })
        if (!cancelled) setBootstrapped(true)
      } catch {
        if (!cancelled) {
          clearTimeout(timeoutId)
          clearAuth()
          setBootstrapped(true)
        }
      }
    }

    restore()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [setAuthContext, setBootstrapped, clearAuth])

  return <>{children}</>
}
