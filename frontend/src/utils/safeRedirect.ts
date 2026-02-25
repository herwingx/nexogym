/**
 * Evita open redirect: solo permite rutas internas (path que empieza con / y no es URL absoluta).
 * Usar si en el futuro se lee redirect desde query params (ej. ?redirect=/admin).
 * Nunca usar un valor de la URL sin pasar por esta función.
 */
export function getSafeRedirectTo(candidate: string | null | undefined, fallback = '/login'): string {
  if (typeof candidate !== 'string' || !candidate.trim()) return fallback
  const path = candidate.trim()
  // Solo path relativo interno: empieza con / pero no con // (protocol-relative)
  if (path.startsWith('/') && !path.startsWith('//')) return path
  return fallback
}
