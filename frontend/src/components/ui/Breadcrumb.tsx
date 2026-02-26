import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildBreadcrumbs, getRouteConfig } from '../../config/routes.config'
import { cn } from '../../lib/utils'

interface BreadcrumbProps {
  /** Clase adicional para el contenedor */
  className?: string
  /** Si true, usar diseño compacto (menos padding) */
  compact?: boolean
}

/**
 * Breadcrumb y botón Volver contextual.
 * - Rutas con parent: muestra miga de pan y botón Volver
 * - Rutas profile/opciones: no muestra Volver (showBack: false)
 * - Rutas raíz: solo miga de pan si hay más de un nivel
 */
export const Breadcrumb = ({ className, compact }: BreadcrumbProps) => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const config = getRouteConfig(pathname)
  const breadcrumbs = buildBreadcrumbs(pathname)

  if (!config || breadcrumbs.length === 0) return null

  const showBack = config.parent && config.showBack !== false

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        className
      )}
    >
      {showBack && (
        <button
          type="button"
          onClick={() => navigate(config.parent!)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 -ml-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
          title={`Volver a ${breadcrumbs.find((b) => b.path === config.parent)?.label ?? 'anterior'}`}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:inline">Volver</span>
        </button>
      )}

      <ol className="flex items-center gap-1.5 min-w-0 flex-wrap">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1
          return (
            <li key={crumb.path} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
              )}
              {isLast ? (
                <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="truncate hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
