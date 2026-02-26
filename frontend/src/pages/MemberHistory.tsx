import { useEffect, useState, useCallback } from 'react'
import { Flame, QrCode, Fingerprint, UserCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchMemberHistory, type VisitEntry } from '../lib/apiClient'
import { notifyError } from '../lib/notifications'
import { cn } from '../lib/utils'
import { ListSkeleton } from '../components/ui/Skeleton'

const METHOD_CONFIG: Record<
  VisitEntry['access_method'],
  { label: string; icon: typeof QrCode; classes: string }
> = {
  QR: {
    label: 'QR',
    icon: QrCode,
    classes: 'text-blue-400 bg-blue-400/10',
  },
  BIOMETRIC: {
    label: 'Biométrico',
    icon: Fingerprint,
    classes: 'text-purple-400 bg-purple-400/10',
  },
  MANUAL: {
    label: 'Manual',
    icon: UserCheck,
    classes: 'text-zinc-400 bg-zinc-400/10',
  },
}

const PAGE_SIZE = 10

export const MemberHistory = () => {
  const [visits, setVisits] = useState<VisitEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    (p: number) => {
      setLoading(true)
      fetchMemberHistory({ page: p, pageSize: PAGE_SIZE })
        .then((res) => {
          setVisits(res.data)
          setTotal(res.total)
        })
        .catch((err) => {
          setVisits([])
          setTotal(0)
          notifyError({
            title: 'Error al cargar visitas',
            description: (err as Error)?.message ?? 'Intenta de nuevo.',
          })
        })
        .finally(() => setLoading(false))
    },
    [],
  )

  useEffect(() => {
    load(page)
  }, [page, load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="px-4 pt-12 pb-6 max-w-md mx-auto">
      {/* Encabezado */}
      <div className="mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
          Portal
        </p>
        <h1 className="text-2xl font-bold text-foreground">Mis visitas</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {total > 0 ? `${total} visitas registradas` : 'Sin visitas aún'}
        </p>
      </div>

      {/* Lista */}
      {loading ? (
        <ListSkeleton count={6} />
      ) : visits.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 text-sm">
          No se encontraron visitas registradas.
        </div>
      ) : (
        <div className="space-y-2">
          {visits.map((visit, idx) => {
            const methodCfg = METHOD_CONFIG[visit.access_method] ?? METHOD_CONFIG.MANUAL
            const MethodIcon = methodCfg.icon
            const date = new Date(visit.checked_in_at)
            const isToday =
              date.toDateString() === new Date().toDateString()
            const isYesterday =
              date.toDateString() ===
              new Date(Date.now() - 864e5).toDateString()

            const dateLabel = isToday
              ? 'Hoy'
              : isYesterday
                ? 'Ayer'
                : date.toLocaleDateString('es-MX', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })

            const timeLabel = date.toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={visit.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-4 py-3 shadow-sm',
                  idx === 0 && 'border-primary/30 bg-primary/5 dark:bg-primary/5',
                )}
              >
                {/* Ícono de método */}
                <div
                  className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                    methodCfg.classes,
                  )}
                >
                  <MethodIcon className="h-4 w-4" />
                </div>

                {/* Fecha y hora */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {dateLabel}
                    <span className="text-zinc-500 ml-1.5 font-normal">
                      {timeLabel}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-500">{methodCfg.label}</p>
                </div>

                {/* Racha en ese check-in */}
                {visit.streak_at_checkin != null &&
                  visit.streak_at_checkin > 0 && (
                    <div className="flex items-center gap-1 text-xs font-medium text-orange-400 shrink-0">
                      <Flame className="h-3.5 w-3.5" />
                      {visit.streak_at_checkin}
                    </div>
                  )}
              </div>
            )
          })}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1.5 text-xs text-zinc-500 disabled:opacity-30 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <span className="text-xs text-zinc-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1.5 text-xs text-zinc-500 disabled:opacity-30 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
