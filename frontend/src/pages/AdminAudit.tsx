import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchAuditLog, fetchStaffUsers, type AuditLogEntry, type StaffUserRow } from '../lib/apiClient'
import { notifyError } from '../lib/notifications'
import { TableRowSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'

const CRITICAL_ACTIONS = new Set([
  'COURTESY_ACCESS_GRANTED',
  'INVENTORY_LOSS_REPORTED',
  'SHIFT_CLOSED',
  'SHIFT_FORCE_CLOSED',
])

/** Todas las etiquetas de auditoría en español (normalización UI). */
const ACTION_LABELS: Record<string, string> = {
  // Turnos y caja
  SHIFT_OPENED: 'Turno abierto',
  SHIFT_CLOSED: 'Turno cerrado',
  SHIFT_FORCE_CLOSED: 'Turno cerrado forzosamente',
  // Inventario
  PRODUCT_CREATED: 'Producto creado',
  PRODUCT_DELETED: 'Producto eliminado',
  PRODUCT_UPDATED: 'Producto actualizado',
  INVENTORY_RESTOCKED: 'Stock repuesto',
  INVENTORY_LOSS_REPORTED: 'Merma reportada',
  // Personal
  STAFF_CREATED: 'Personal dado de alta',
  STAFF_RESTORED: 'Personal restaurado',
  STAFF_PASSWORD_RESET: 'Contraseña de personal restablecida',
  USER_SOFT_DELETED: 'Usuario dado de baja',
  USER_UPDATED: 'Usuario actualizado',
  STAFF_PERMISSIONS_UPDATED: 'Permisos de personal actualizados',
  QR_RESENT: 'QR reenviado',
  QR_REGENERATED: 'QR regenerado',
  // Socios y suscripciones
  SUBSCRIPTION_RENEWED: 'Suscripción renovada',
  SUBSCRIPTION_FROZEN: 'Suscripción congelada',
  SUBSCRIPTION_UNFROZEN: 'Suscripción descongelada',
  SUBSCRIPTION_CANCELED: 'Suscripción cancelada',
  SUBSCRIPTIONS_SYNC_EXPIRED: 'Suscripciones marcadas vencidas (sync)',
  // Otros
  COURTESY_ACCESS_GRANTED: 'Cortesía otorgada',
  USER_DATA_EXPORTED: 'Exportación de datos de usuario',
  USER_DATA_ANONYMIZED: 'Datos de usuario anonimizados',
  CHECKIN_SUCCESS: 'Check-in exitoso',
  MEMBER_CREATED: 'Socio creado',
  MEMBER_UPDATED: 'Socio actualizado',
  MEMBER_PORTAL_ACCESS_SENT: 'Acceso al portal enviado',
  SALE_CREATED: 'Venta registrada',
}

const ALL_ACTIONS = Object.keys(ACTION_LABELS).sort()

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
  const [userIdFilter, setUserIdFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [staff, setStaff] = useState<StaffUserRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const PAGE_SIZE = 20

  useEffect(() => {
    fetchStaffUsers(1, 200, 'all')
      .then((r) => setStaff(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const data = await fetchAuditLog({
          action: actionFilter || undefined,
          userId: userIdFilter || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
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
  }, [actionFilter, userIdFilter, fromDate, toDate, page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">Auditoría</h1>
          <p className="text-sm text-zinc-500">
            Registro de acciones críticas. Filtra por fecha, usuario y tipo.
          </p>
        </header>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                setPage(1)
              }}
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                setPage(1)
              }}
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Usuario
            </label>
            <select
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={userIdFilter}
              onChange={(e) => {
                setUserIdFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Todos</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.phone ?? u.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Acción
            </label>
            <select
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-primary/50"
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
          </div>
        </div>

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
                          <pre className="mt-1 rounded-md border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/80 p-2 text-xs text-zinc-700 dark:text-zinc-300 overflow-x-auto max-w-xs md:max-w-sm">
                            {JSON.stringify(entry.details, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
          {total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
            <span>
              {entries.length} de {total} registros
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span>
                  Página {page} de {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
