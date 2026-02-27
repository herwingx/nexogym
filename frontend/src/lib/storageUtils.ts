const GYM_LOGOS_BUCKET = 'gym-logos'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''

/** Extrae el path del archivo en el bucket gym-logos desde una URL pública de Supabase. */
export function getGymLogoStoragePath(url: string): string | null {
  if (!SUPABASE_URL) return null
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${GYM_LOGOS_BUCKET}/`
  if (!url.startsWith(prefix)) return null
  return url.slice(prefix.length) || null
}

export { GYM_LOGOS_BUCKET }
