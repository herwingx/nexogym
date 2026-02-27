import { useCallback, useEffect, useState } from 'react'
import { Flame, User, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchStaffLeaderboard, type LeaderboardEntry } from '../lib/apiClient'
import { notifyError } from '../lib/notifications'
import { cn } from '../lib/utils'
import { TableRowSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'

const PAGE_SIZE = 20

export const AdminLeaderboard = () => {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number }>({ total: 0, page: 1, limit: PAGE_SIZE })
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const load = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      const res = await fetchStaffLeaderboard({
        page,
        limit: PAGE_SIZE,
        q: query.trim().length >= 2 ? query.trim() : undefined,
      })
      setData(res.data)
      setMeta(res.meta)
    } catch (e) {
      const msg = (e as Error)?.message ?? ''
      const isForbidden =
        msg.includes('403') ||
        msg.includes('Forbidden') ||
        msg.includes('desactivado') ||
        msg.includes('permiso')
      notifyError({
        title: 'Error al cargar leaderboard',
        description: isForbidden
          ? 'No tienes acceso o el módulo de gamificación no está habilitado. Contacta al administrador.'
          : 'No se pudo cargar el leaderboard. Verifica tu conexión e intenta de nuevo.',
      })
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    const t = setTimeout(() => void load(1), query.trim().length >= 2 ? 300 : 0)
    return () => clearTimeout(t)
  }, [query, load])

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Leaderboard de rachas
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Socios ordenados por racha actual. Para verificar ganadores y premios.
        </p>
      </header>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre (mín. 2 caracteres)"
          className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 py-2.5 pl-10 pr-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
        />
      </div>

      <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        {loading ? (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <th className="py-4 px-5 sm:px-6 text-left font-medium">#</th>
                <th className="py-4 px-5 sm:px-6 text-left font-medium">Nombre</th>
                <th className="py-4 px-5 sm:px-6 text-right font-medium">Racha</th>
              </tr>
            </thead>
            <tbody>
              <TableRowSkeleton columns={3} rows={10} />
            </tbody>
          </table>
        ) : data.length === 0 ? (
          <div className="py-16 px-6 text-center text-zinc-500 dark:text-zinc-400 text-sm">
            {query.trim().length >= 2
              ? 'Sin resultados para esta búsqueda.'
              : 'No hay socios con rachas registradas.'}
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                <th className="py-4 px-5 sm:px-6 text-left font-medium">#</th>
                <th className="py-4 px-5 sm:px-6 text-left font-medium">Nombre</th>
                <th className="py-4 px-5 sm:px-6 text-right font-medium">Racha</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr
                  key={entry.id}
                  className={cn(
                    'border-t border-zinc-200 dark:border-zinc-800/60 transition-colors',
                    'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
                    entry.rank <= 3 && 'bg-primary/5 dark:bg-primary/10',
                  )}
                >
                  <td className="py-3 px-5 sm:px-6">
                    <span
                      className={cn(
                        'inline-flex w-8 h-8 rounded-full items-center justify-center text-xs font-bold shrink-0',
                        entry.rank === 1 && 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
                        entry.rank === 2 && 'bg-zinc-300/80 text-zinc-600 dark:bg-zinc-400 dark:text-zinc-800',
                        entry.rank === 3 && 'bg-amber-700/30 text-amber-800 dark:text-amber-600',
                        entry.rank > 3 && 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300',
                      )}
                    >
                      {entry.rank}
                    </span>
                  </td>
                  <td className="py-3 px-5 sm:px-6">
                    <div className="flex items-center gap-4">
                      {entry.profile_picture_url ? (
                        <img
                          src={entry.profile_picture_url}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover shrink-0 border border-zinc-200/80 dark:border-white/10"
                        />
                      ) : (
                        <span className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0 border border-zinc-200/80 dark:border-white/10">
                          <User className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                        </span>
                      )}
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {entry.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-5 sm:px-6 text-right">
                    <span className="inline-flex items-center gap-1.5 text-primary font-semibold">
                      <Flame className="h-4 w-4 shrink-0" />
                      {entry.current_streak}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {meta.total > PAGE_SIZE && !loading && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              {data.length} de {meta.total}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => load(meta.page - 1)}
                disabled={meta.page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => load(meta.page + 1)}
                disabled={meta.page * meta.limit >= meta.total || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
