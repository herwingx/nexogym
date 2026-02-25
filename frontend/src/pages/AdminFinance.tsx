import { useEffect, useState } from 'react'
import { fetchFinanceReport, type FinanceReport } from '../lib/apiClient'
import { notifyError } from '../lib/notifications'
import { CardSkeleton, TableRowSkeleton } from '../components/ui/Skeleton'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const selectCls =
  'rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-primary/50'

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const AdminFinance = () => {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [report, setReport] = useState<FinanceReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const data = await fetchFinanceReport(year, month)
        setReport(data)
      } catch (error: unknown) {
        notifyError({
          title: 'No pudimos cargar el reporte',
          description: (error as Error)?.message ?? 'Intenta de nuevo.',
        })
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [year, month])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Reporte Financiero
            </h1>
            <p className="text-sm text-zinc-500">
              Desglose mensual de ventas, egresos y ganancia neta.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              className={selectCls}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className={selectCls}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Cards de resumen */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isLoading ? (
            <CardSkeleton count={3} lines={1} />
          ) : (
            <>
              <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Total ventas
                </p>
                <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                  ${fmt(report?.total_sales ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Total egresos
                </p>
                <p className="text-2xl font-semibold text-rose-600 dark:text-rose-400">
                  -${fmt(report?.total_expenses ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Ganancia neta
                </p>
                <p
                  className={`text-2xl font-semibold ${(report?.net_profit ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                >
                  {(report?.net_profit ?? 0) >= 0 ? '+' : '-'}$
                  {fmt(Math.abs(report?.net_profit ?? 0))}
                </p>
              </div>
            </>
          )}
        </section>

        {/* Tabla de ventas diarias */}
        <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
            Desglose por día
          </h2>
          {isLoading ? (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                  <th className="py-2 pr-4 text-left font-medium">Fecha</th>
                  <th className="py-2 pl-4 text-right font-medium">Ventas</th>
                </tr>
              </thead>
              <tbody>
                <TableRowSkeleton columns={2} rows={5} />
              </tbody>
            </table>
          ) : !report || report.sales_breakdown.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Sin ventas registradas para este período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                    <th className="py-2 pr-4 text-left font-medium">Fecha</th>
                    <th className="py-2 pl-4 text-right font-medium">Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sales_breakdown.map((entry) => (
                    <tr
                      key={entry.date}
                      className="border-t border-zinc-200 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="py-2.5 pr-4 text-zinc-700 dark:text-zinc-300 text-xs">
                        {new Date(entry.date).toLocaleDateString('es-MX', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td className="py-2.5 pl-4 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        ${fmt(entry.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-200 dark:border-zinc-700">
                    <td className="py-2.5 pr-4 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Total
                    </td>
                    <td className="py-2.5 pl-4 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      ${fmt(report.total_sales)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
