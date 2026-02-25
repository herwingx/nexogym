import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { fetchAuditLog, type AuditLogEntry } from '../lib/apiClient'
import { notifyError } from '../lib/notifications'
import { TableRowSkeleton } from '../components/ui/Skeleton'

const CRITICAL_ACTIONS = new Set([
  'COURTESY_ACCESS_GRANTED',
  'INVENTORY_LOSS_REPORTED',
  'SHIFT_CLOSED',
])

const ACTION_LABELS: Record<string, string> = {
  COURTESY_ACCESS_GRANTED: 'Cortesía otorgada',
  INVENTORY_LOSS_REPORTED: 'Merma reportada',
  SHIFT_CLOSED: 'Turno cerrado',
  CHECKIN_SUCCESS: 'Check-in exitoso',
  MEMBER_CREATED: 'Socio creado',
  MEMBER_UPDATED: 'Socio actualizado',
  SALE_CREATED: 'Venta registrada',
  SUBSCRIPTION_RENEWED: 'Suscripción renovada',
  SUBSCRIPTION_FROZEN: 'Suscripción congelada',
  SUBSCRIPTION_UNFROZEN: 'Suscripción descongelada',
  SUBSCRIPTIONS_SYNC_EXPIRED: 'Suscripciones marcadas vencidas (sync)',
}

const ALL_ACTIONS = Object.keys(ACTION_LABELS)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

export const AdminAudit = () => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const PAGE_SIZE = 20

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const data = await fetchAuditLog({
          action: actionFilter || undefined,
          page,
          pageSize: PAGE_SIZE,
        })
        setEntries(data.data)
        setTotal(data.total)
      } catch (error: unknown) {
        notifyError({
          title: 'No pudimos cargar la auditoría',
          description: (error as Error)?.message ?? 'Intenta de nuevo.',
        })
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [actionFilter, page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Auditoría
            </h1>
            <p className="text-sm text-zinc-500">
              Registro de acciones críticas del ERP. Filtrable por tipo de evento.
            </p>
          </div>
          <select
            className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Todas las acciones</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </header>

        <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <th className="py-2 pr-4 text-left font-medium">Acción</th>
                <th className="py-2 px-4 text-left font-medium">Usuario</th>
                <th className="py-2 px-4 text-left font-medium">Fecha</th>
                <th className="py-2 pl-4 text-left font-medium">Detalles</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableRowSkeleton columns={4} rows={8} />}
              {!isLoading && entries.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-6 text-center text-xs text-zinc-500"
                  >
                    Sin registros para el filtro seleccionado.
                  </td>
                </tr>
              )}
              {!isLoading &&
                entries.map((entry) => {
                  const isCritical = CRITICAL_ACTIONS.has(entry.action)
                  const isExpanded = expandedId === entry.id
                  return (
                    <tr
                      key={entry.id}
                      className={`border-t border-zinc-200 dark:border-zinc-800/60 ${isCritical ? 'bg-rose-500/5' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                    >
                      <td className="py-2.5 pr-4 align-top text-xs">
                        <div className="flex items-center gap-1.5">
                          {isCritical && (
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                          )}
                          <span
                            className={
                              isCritical
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-zinc-700 dark:text-zinc-200'
                            }
                          >
                            {ACTION_LABELS[entry.action] ?? entry.action}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 align-top text-xs text-zinc-500">
                        {entry.user_name ?? entry.user_id.slice(0, 8) + '…'}
                      </td>
                      <td className="py-2.5 px-4 align-top text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="py-2.5 pl-4 align-top text-xs text-zinc-500">
                        <details
                          open={isExpanded}
                          onToggle={(e) =>
                            setExpandedId(
                              (e.target as HTMLDetailsElement).open
                                ? entry.id
                                : null,
                            )
                          }
                        >
                          <summary className="cursor-pointer text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 select-none">
                            {isExpanded ? 'Ocultar' : 'Ver detalles'}
                          </summary>
                          <pre className="mt-1 rounded-md border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/80 p-2 text-[10px] text-zinc-700 dark:text-zinc-300 overflow-x-auto max-w-xs md:max-w-sm">
                            {JSON.stringify(entry.details, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </section>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
            <button
              type="button"
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 disabled:opacity-40 text-zinc-700 dark:text-zinc-300"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages} · {total} registros
            </span>
            <button
              type="button"
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 disabled:opacity-40 text-zinc-700 dark:text-zinc-300"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
