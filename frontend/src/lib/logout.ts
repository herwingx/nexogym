import { supabase } from './supabaseClient'
import { useAuthStore } from '../store/useAuthStore'

/**
 * Cierra sesión en Supabase (borra el token persistido) y limpia el store.
 * Después de llamarla, redirige a /login (desde el componente con useNavigate).
 */
export async function logout(): Promise<void> {
  await supabase.auth.signOut()
  useAuthStore.getState().clearAuth()
  useAuthStore.getState().setBootstrapped(true)
}
