import { useEffect, useState } from 'react'
import { fetchFinanceReport, fetchOccupancy, type OccupancyResponse, type FinanceReport } from '../lib/apiClient'
import { notifyError } from '../lib/notifications'
import { CardSkeleton } from '../components/ui/Skeleton'

type OccupancyLevel = 'empty' | 'normal' | 'full'

const getOccupancyLevel = (count: number): OccupancyLevel => {
  if (count === 0) return 'empty'
  if (count <= 20) return 'normal'
  return 'full'
}

const OCCUPANCY_STYLES: Record<OccupancyLevel, { dot: string; label: string; text: string }> = {
  empty: {
    dot: 'bg-emerald-500',
    label: 'Vacío',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  normal: {
    dot: 'bg-amber-500',
    label: 'Normal',
    text: 'text-amber-600 dark:text-amber-400',
  },
  full: {
    dot: 'bg-rose-500',
    label: '¡Lleno!',
    text: 'text-rose-600 dark:text-rose-400',
  },
}

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const AdminDashboard = () => {
  const now = new Date()
  const [occupancy, setOccupancy] = useState<OccupancyResponse | null>(null)
  const [finance, setFinance] = useState<FinanceReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const [occ, fin] = await Promise.all([
          fetchOccupancy(),
          fetchFinanceReport(now.getFullYear(), now.getMonth() + 1),
        ])
        setOccupancy(occ)
        setFinance(fin)
      } catch (error: unknown) {
        notifyError({
          title: 'No pudimos cargar el dashboard',
          description:
            (error as Error)?.message ?? 'Intenta de nuevo en unos segundos.',
        })
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  const occupancyLevel = getOccupancyLevel(occupancy?.current_count ?? 0)
  const styles = OCCUPANCY_STYLES[occupancyLevel]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-zinc-500">
              Resumen operativo en tiempo real.
            </p>
          </div>
        </header>

        {/* Semáforo de ocupación + cards de métricas */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isLoading ? (
            <CardSkeleton count={3} lines={2} />
          ) : (
            <>
              {/* Semáforo */}
              <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Ocupación actual
                </p>
                <div className="flex items-center gap-3">
                  <span
                    className={`h-3 w-3 rounded-full animate-pulse ${styles.dot}`}
                  />
                  <span className={`text-2xl font-semibold ${styles.text}`}>
                    {occupancy?.current_count ?? 0}
                    <span className="ml-1 text-sm font-normal text-zinc-400">
                      / {occupancy?.capacity ?? '∞'} personas
                    </span>
                  </span>
                </div>
                <p className={`text-xs font-medium ${styles.text}`}>
                  {styles.label}
                </p>
              </div>

              {/* Ventas del mes */}
              <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Ventas del mes
                </p>
                <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                  ${fmt(finance?.total_sales ?? 0)}
                </p>
                <p className="text-xs text-zinc-500">
                  Egresos:{' '}
                  <span className="text-rose-600 dark:text-rose-400">
                    -${fmt(finance?.total_expenses ?? 0)}
                  </span>
                </p>
              </div>

              {/* Ganancia neta */}
              <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Ganancia neta
                </p>
                <p
                  className={`text-2xl font-semibold ${(finance?.net_profit ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                >
                  {(finance?.net_profit ?? 0) >= 0 ? '' : '-'}$
                  {fmt(Math.abs(finance?.net_profit ?? 0))}
                </p>
                <p className="text-xs text-zinc-500">
                  Período: {finance?.period ?? now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </>
          )}
        </section>

        {/* Mini gráfica de ventas por día */}
        {finance && finance.sales_breakdown.length > 0 && (
          <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              Ventas por día — {finance.period}
            </h2>
            <div className="flex items-end gap-1 h-24 overflow-x-auto pb-1">
              {finance.sales_breakdown.map((entry) => {
                const max = Math.max(...finance.sales_breakdown.map((e) => e.amount), 1)
                const heightPct = (entry.amount / max) * 100
                return (
                  <div
                    key={entry.date}
                    className="flex flex-col items-center gap-1 min-w-[1.75rem] flex-1"
                  >
                    <div
                      className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors"
                      style={{ height: `${heightPct}%`, minHeight: '4px' }}
                      title={`${entry.date}: $${fmt(entry.amount)}`}
                    />
                    <span className="text-[9px] text-zinc-600 rotate-0">
                      {new Date(entry.date).getDate()}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-[10px] text-zinc-600">
              Cada barra representa el total de ventas de ese día.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
