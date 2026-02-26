import { Link } from 'react-router-dom'
import { FileQuestion, ArrowLeft } from 'lucide-react'

type ResourceNotFoundProps = {
  /** Título (ej. "Turno no encontrado", "Socio no encontrado") */
  title?: string
  /** Ruta del botón Volver */
  backTo: string
  /** Texto del botón */
  backLabel?: string
}

/**
 * Pantalla reutilizable cuando un recurso no existe (404).
 */
export const ResourceNotFound = ({
  title = 'Recurso no encontrado',
  backTo,
  backLabel = 'Volver',
}: ResourceNotFoundProps) => {
  return (
    <div className="min-h-[50vh] flex items-center justify-center bg-background text-foreground px-4 py-8">
      <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/80 px-6 py-8 backdrop-blur-md shadow-soft max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200/80 dark:bg-zinc-700/50">
          <FileQuestion className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
          {title}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          El recurso que buscas no existe o ya no está disponible.
        </p>
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
