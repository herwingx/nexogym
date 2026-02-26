import { Link } from 'react-router-dom'
import { Lock, ArrowLeft } from 'lucide-react'

type PlanRestrictionCardProps = {
  /** Ruta a la que lleva el botón "Volver" (ej. /admin, /reception, /member) */
  backTo: string
  /** Texto del botón */
  backLabel?: string
  /** Mensaje adicional bajo el párrafo principal */
  detail?: string
}

/**
 * Tarjeta reutilizable cuando el usuario no tiene acceso a un recurso porque no está en el plan de su gym.
 * Misma línea visual que la pantalla de bloqueo del socio en plan Basic.
 */
export const PlanRestrictionCard = ({
  backTo,
  backLabel = 'Volver',
  detail,
}: PlanRestrictionCardProps) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-background text-foreground px-4 py-8">
      <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/80 px-6 py-8 backdrop-blur-md shadow-soft max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
          <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
          No tienes acceso a este recurso
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          No está incluido en el plan actual de tu gimnasio. Solo el administrador o el SuperAdmin pueden cambiar el plan o los módulos.
        </p>
        {detail && (
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-4">
            {detail}
          </p>
        )}
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-white/10 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </div>
    </div>
  )
}
