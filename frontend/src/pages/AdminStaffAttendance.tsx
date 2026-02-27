import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, UserCheck } from 'lucide-react'
import { fetchVisits, fetchStaffUsers, type VisitRow, type StaffUserRow } from '../lib/apiClient'
import { notifyError } from '../lib/notifications'
import { TableRowSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  SUPERADMIN: 'Super Admin',
  RECEPTIONIST: 'Recepcionista',
  COACH: 'Coach',
  INSTRUCTOR: 'Instructor',
  MEMBER: 'Socio',
  CLEANING: 'Limpieza',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })

export const AdminStaffAttendance = () => {
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, total_pages: 1 })
  const [staff, setStaff] = useState<StaffUserRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')
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
        const data = await fetchVisits({
          page,
          limit: PAGE_SIZE,
          staff_only: true,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          user_id: userIdFilter || undefined,
        })
        setVisits(data.data)
        setMeta(data.meta)
      } catch (error: unknown) {
        notifyError({
          title: 'No pudimos cargar asistencia',
          description: (error as Error)?.message ?? 'Intenta de nuevo.',
        })
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [page, fromDate, toDate, userIdFilter])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <header>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Asistencia de personal
          </h1>
          <p className="text-sm text-zinc-500">
            Checadas de entrada del personal (staff). Filtra por fecha y usuario para puntualidad.
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
        </div>

        <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <th className="py-2 pr-4 text-left font-medium">Fecha y hora</th>
                <th className="py-2 px-4 text-left font-medium">Usuario</th>
                <th className="py-2 px-4 text-left font-medium">Rol</th>
                <th className="py-2 px-4 text-left font-medium">Método</th>
                <th className="py-2 pl-4 text-left font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableRowSkeleton columns={5} rows={8} />}
              {!isLoading && visits.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-zinc-500">
                    Sin checadas para el filtro seleccionado.
                  </td>
                </tr>
              )}
              {!isLoading &&
                visits.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="py-2 pr-4">{formatDate(v.check_in_time)}</td>
                    <td className="py-2 px-4">{v.user_name ?? v.user_phone ?? v.user_id.slice(0, 8)}</td>
                    <td className="py-2 px-4">{v.user_role ? ROLE_LABELS[v.user_role] ?? v.user_role : '-'}</td>
                    <td className="py-2 px-4">{v.access_method}</td>
                    <td className="py-2 pl-4">{v.access_type}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          {meta.total_pages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-zinc-200 dark:border-zinc-800">
              <p className="text-xs text-zinc-500">
                {meta.total} checada{meta.total !== 1 ? 's' : ''} · Página {meta.page} de {meta.total_pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
                  disabled={page >= meta.total_pages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
