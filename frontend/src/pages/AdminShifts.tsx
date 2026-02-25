import { useEffect, useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { fetchShifts, type ShiftRow } from '../lib/apiClient'
import { notifyError } from '../lib/notifications'
import { TableRowSkeleton } from '../components/ui/Skeleton'

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })

function StatusBadge({ expected, actual }: { expected: number; actual: number }) {
  const diff = actual - expected
  if (diff === 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <Minus className="h-3 w-3" />
        BALANCED
      </span>
    )
  if (diff > 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
        <TrendingUp className="h-3 w-3" />
        SURPLUS (+${fmt(diff)})
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
      <TrendingDown className="h-3 w-3" />
      SHORTAGE (${fmt(diff)})
    </span>
  )
}

export const AdminShifts = () => {
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 })
  const [loading, setLoading] = useState(true)

  const load = async (page = 1) => {
    try {
      setLoading(true)
      const res = await fetchShifts(page, 20)
      setShifts(res.data)
      setMeta(res.meta)
    } catch (e) {
      notifyError({
        title: 'Error al cargar turnos',
        description: (e as Error)?.message ?? 'Intenta de nuevo.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Cortes de caja
            </h1>
            <p className="text-sm text-zinc-500">
              Historial de turnos cerrados. Revisa BALANCED / SURPLUS / SHORTAGE.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <th className="py-3 px-4 text-left font-medium">Apertura</th>
                <th className="py-3 px-4 text-left font-medium">Cierre</th>
                <th className="py-3 px-4 text-left font-medium">Usuario</th>
                <th className="py-3 px-4 text-right font-medium">Fondo</th>
                <th className="py-3 px-4 text-right font-medium">Esperado</th>
                <th className="py-3 px-4 text-right font-medium">Real</th>
                <th className="py-3 px-4 text-center font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton cols={7} rows={8} />
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    No hay turnos cerrados.
                  </td>
                </tr>
              ) : (
                shifts.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-zinc-200 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="py-2.5 px-4 text-zinc-700 dark:text-zinc-300">
                      {formatDate(s.opened_at)}
                    </td>
                    <td className="py-2.5 px-4 text-zinc-700 dark:text-zinc-300">
                      {s.closed_at ? formatDate(s.closed_at) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-zinc-900 dark:text-zinc-100 font-medium">
                      {s.user?.name ?? '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right text-zinc-700 dark:text-zinc-300">
                      ${fmt(Number(s.opening_balance))}
                    </td>
                    <td className="py-2.5 px-4 text-right text-zinc-700 dark:text-zinc-300">
                      ${fmt(Number(s.expected_balance ?? 0))}
                    </td>
                    <td className="py-2.5 px-4 text-right text-zinc-700 dark:text-zinc-300">
                      ${fmt(Number(s.actual_balance ?? 0))}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {s.expected_balance != null && s.actual_balance != null ? (
                        <StatusBadge
                          expected={Number(s.expected_balance)}
                          actual={Number(s.actual_balance)}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              className="rounded-md border border-zinc-200 dark:border-white/10 px-3 py-1.5 text-xs disabled:opacity-50"
              disabled={meta.page <= 1}
              onClick={() => void load(meta.page - 1)}
            >
              Anterior
            </button>
            <span className="text-xs text-zinc-500">
              Página {meta.page} de {totalPages}
            </span>
            <button
              type="button"
              className="rounded-md border border-zinc-200 dark:border-white/10 px-3 py-1.5 text-xs disabled:opacity-50"
              disabled={meta.page >= totalPages}
              onClick={() => void load(meta.page + 1)}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
