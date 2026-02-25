import { cn } from '../../lib/utils'

const baseClass = 'animate-pulse rounded bg-zinc-200 dark:bg-zinc-800'

/**
 * Bloque genérico. Usar className para ancho/alto.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(baseClass, className)} {...props} />
}

/**
 * Card con label + líneas de contenido (métricas, dashboards).
 * Mantiene la misma estructura visual que las cards de UI_UX_GUIDELINES.
 */
export function CardSkeleton({
  count = 1,
  lines = 2,
  className,
}: {
  count?: number
  lines?: number
  className?: string
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-3',
            className,
          )}
        >
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: lines }).map((_, j) => (
            <Skeleton key={j} className="h-6 w-full max-w-[8rem]" />
          ))}
          {lines > 1 && <Skeleton className="h-3 w-32" />}
        </div>
      ))}
    </>
  )
}

/**
 * Fila de tabla con N celdas (listas, auditoría).
 */
export function TableRowSkeleton({
  columns = 4,
  rows = 5,
}: {
  columns?: number
  rows?: number
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr
          key={rowIdx}
          className="border-t border-zinc-200 dark:border-zinc-800/60"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <td key={colIdx} className="py-2.5 px-4">
              <Skeleton
                className="h-4 w-full"
                style={{
                  maxWidth: colIdx === columns - 1 ? 80 : undefined,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/**
 * Lista de items (clases, rutinas, historial).
 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 flex items-center gap-3"
        >
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}
