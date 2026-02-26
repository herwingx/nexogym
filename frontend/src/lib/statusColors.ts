/**
 * Paleta de colores de estado — NexoGym
 *
 * Usa esta paleta para badges, textos y bordes semánticos.
 * Garantiza consistencia visual en toda la app.
 *
 * Semántica:
 * - success: activo, correcto, cuadrado
 * - danger: error, expirado, faltante, eliminar
 * - warning: advertencia, pendiente, sobrante
 * - info: informativo, congelado, neutro-azul
 * - neutral: cancelado, inactivo, deshabilitado
 */

export const STATUS_BADGE = {
  success:
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  warning:
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  neutral: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  /** Estado deshabilitado/inactivo (más apagado que neutral) */
  inactive: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-500 border-zinc-500/20',
} as const

export const STATUS_BADGE_BORDER = {
  success: 'border-emerald-500/30',
  danger: 'border-rose-500/30',
  warning: 'border-amber-500/30',
  info: 'border-blue-500/30',
  neutral: 'border-zinc-500/30',
} as const

export const STATUS_TEXT = {
  success: 'text-emerald-600 dark:text-emerald-400',
  danger: 'text-rose-600 dark:text-rose-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-blue-600 dark:text-blue-400',
  neutral: 'text-zinc-600 dark:text-zinc-400',
} as const

/** Variantes para botones outline de acción destructiva (Dar de baja, Eliminar) */
export const STATUS_BUTTON_DANGER_OUTLINE =
  'border-rose-500/50 text-rose-600 hover:bg-rose-500/10 dark:border-rose-400 dark:text-rose-400 dark:hover:bg-rose-500/10'

/** Clases base compartidas para badges de tabla (Cuadrado, Sobrante, Faltante) */
export const BADGE_BASE =
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0'
