import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Wallet, TrendingUp, TrendingDown, Minus, AlertCircle, FileText } from 'lucide-react'
import { fetchShifts, fetchOpenShifts, forceCloseShift, fetchShiftSales, type ShiftRow, type OpenShiftRow, type ShiftSalesResponse } from '../lib/apiClient'
import { notifyError, notifySuccess } from '../lib/notifications'
import { TableRowSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { useAuthStore } from '../store/useAuthStore'
import { PlanRestrictionCard } from '../components/ui/PlanRestrictionCard'
import { isPlanRestrictionError } from '../lib/apiErrors'
import {
  STATUS_BADGE,
  STATUS_BADGE_BORDER,
  BADGE_BASE,
} from '../lib/statusColors'

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })

const STATUS_LABELS = {
  balanced: 'Cuadrado',
  surplus: 'Sobrante',
  shortage: 'Faltante',
} as const

function StatusBadge({ expected, actual }: { expected: number; actual: number }) {
  const diff = actual - expected
  if (diff === 0)
    return (
      <span className={`${BADGE_BASE} border ${STATUS_BADGE_BORDER.success} ${STATUS_BADGE.success}`}>
        <Minus className="h-3 w-3 shrink-0" />
        {STATUS_LABELS.balanced}
      </span>
    )
  if (diff > 0)
    return (
      <span className={`${BADGE_BASE} border ${STATUS_BADGE_BORDER.warning} ${STATUS_BADGE.warning}`}>
        <TrendingUp className="h-3 w-3 shrink-0" />
        {STATUS_LABELS.surplus} +${fmt(diff)}
      </span>
    )
  return (
    <span className={`${BADGE_BASE} border ${STATUS_BADGE_BORDER.danger} ${STATUS_BADGE.danger}`}>
      <TrendingDown className="h-3 w-3 shrink-0" />
      {STATUS_LABELS.shortage} ${fmt(diff)}
    </span>
  )
}

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

export const AdminShifts = () => {
  const modules = useAuthStore((s) => s.modulesConfig)
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [openShifts, setOpenShifts] = useState<OpenShiftRow[]>([])
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 })
  const [loading, setLoading] = useState(true)
  const [loadingOpen, setLoadingOpen] = useState(true)
  const [forceCloseTarget, setForceCloseTarget] = useState<OpenShiftRow | null>(null)
  const [forceClosing, setForceClosing] = useState(false)
  const [detailShift, setDetailShift] = useState<ShiftSalesResponse | null>(null)
  const [detailShiftId, setDetailShiftId] = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [accessDeniedByPlan, setAccessDeniedByPlan] = useState(false)

  if (!modules.pos) return <Navigate to="/admin" replace />
  if (accessDeniedByPlan) return <PlanRestrictionCard backTo="/admin" backLabel="Volver al inicio" />

  const load = async (page = 1) => {
    try {
      setLoading(true)
      setAccessDeniedByPlan(false)
      const res = await fetchShifts(page, 20)
      setShifts(res.data)
      setMeta(res.meta)
    } catch (e) {
      if (isPlanRestrictionError(e)) {
        setAccessDeniedByPlan(true)
        return
      }
      notifyError({
        title: 'Error al cargar turnos',
        description: (e as Error)?.message ?? 'Intenta de nuevo.',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadOpen = async () => {
    try {
      setLoadingOpen(true)
      const res = await fetchOpenShifts()
      setOpenShifts(res.data ?? [])
    } catch {
      setOpenShifts([])
    } finally {
      setLoadingOpen(false)
    }
  }

  useEffect(() => {
    void load()
    void loadOpen()
  }, [])

  const handleForceCloseConfirm = async () => {
    if (!forceCloseTarget) return
    setForceClosing(true)
    try {
      await forceCloseShift(forceCloseTarget.id, 0)
      notifySuccess({ title: 'Turno cerrado forzosamente' })
      setForceCloseTarget(null)
      void load()
      void loadOpen()
    } catch (e) {
      notifyError({
        title: 'Error al forzar cierre',
        description: (e as Error)?.message ?? '',
      })
    } finally {
      setForceClosing(false)
    }
  }

  const openDetail = async (shiftId: string) => {
    const id = shiftId?.trim()
    if (!id) {
      notifyError({ title: 'Error', description: 'ID de turno no válido.' })
      return
    }
    setDetailShiftId(id)
    setDetailShift(null)
    setLoadingDetail(true)
    try {
      const res = await fetchShiftSales(id)
      setDetailShift(res)
    } catch (e) {
      notifyError({ title: 'Error', description: (e as Error)?.message ?? '' })
      setDetailShiftId(null)
    } finally {
      setLoadingDetail(false)
    }
  }

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
              Historial de turnos cerrados. Estados: Cuadrado, Sobrante, Faltante.
            </p>
          </div>
        </header>

        {loadingOpen ? null : openShifts.length > 0 ? (
          <section className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-medium mb-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              Turnos abiertos (sin corte)
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300/90 mb-3">
              Quienes tienen turno abierto deben hacer corte de caja antes de cerrar sesión. Los ingresos de todos los turnos se reflejan aquí una vez cerrados.
            </p>
            <ul className="space-y-1.5 text-sm">
              {openShifts.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-zinc-700 dark:text-zinc-300"
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="font-medium">{s.user?.name ?? 'Sin nombre'}</span>
                    <span className="text-zinc-500 text-xs">
                      abierto {formatTime(s.opened_at)} · Fondo ${fmt(Number(s.opening_balance ?? 0))}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-rose-500 text-rose-600 hover:bg-rose-500/10 dark:border-rose-400 dark:text-rose-400 dark:hover:bg-rose-500/10"
                    onClick={() => setForceCloseTarget(s)}
                  >
                    Forzar Cierre
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {forceCloseTarget && (
          <Modal
            isOpen
            title="Forzar cierre de turno"
            onClose={() => !forceClosing && setForceCloseTarget(null)}
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              ¿Cerrar forzosamente el turno de <strong>{forceCloseTarget.user?.name ?? 'Sin nombre'}</strong>?
              Se registrará saldo real $0.00. Esta acción queda en auditoría.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForceCloseTarget(null)}
                disabled={forceClosing}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleForceCloseConfirm}
                disabled={forceClosing}
              >
                {forceClosing ? 'Cerrando...' : 'Forzar cierre'}
              </Button>
            </div>
          </Modal>
        )}

        {(detailShiftId != null || detailShift != null) && (
          <Modal
            isOpen
            title="Transacciones del corte"
            onClose={() => {
              setDetailShiftId(null)
              setDetailShift(null)
            }}
          >
            {loadingDetail ? (
              <p className="text-sm text-zinc-500 py-4">Cargando...</p>
            ) : detailShift ? (
              <div className="space-y-4">
                <p className="text-xs text-zinc-500">
                  Apertura: {formatDate(detailShift.shift.opened_at)}
                  {detailShift.shift.closed_at && ` · Cierre: ${formatDate(detailShift.shift.closed_at)}`}
                </p>
                {detailShift.data.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sin ventas en este turno.</p>
                ) : (
                  <>
                    <p className="text-xs text-zinc-500">
                      Ventas del corte agrupadas por folio (cada bloque es un ticket/recibo). Dentro de cada folio, el desglose por producto.
                    </p>
                    <div className="overflow-x-auto max-h-[60vh] space-y-4 rounded-lg">
                      {detailShift.data.map((sale) => (
                        <div
                          key={sale.id}
                          className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 overflow-hidden"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/50 px-3 py-2 text-xs">
                            <span className="font-mono text-zinc-700 dark:text-zinc-300">
                              Folio: {sale.receipt_folio ?? '—'}
                            </span>
                            <span className="text-zinc-600 dark:text-zinc-400">
                            {formatDate(sale.created_at)}
                          </span>
                          <span className="text-zinc-700 dark:text-zinc-300">
                            {sale.seller?.name ?? '—'}
                          </span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            Total: ${fmt(sale.total)}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-500">
                                <th className="py-1.5 px-3 text-left font-medium">Producto</th>
                                <th className="py-1.5 px-3 text-right font-medium">Cant.</th>
                                <th className="py-1.5 px-3 text-right font-medium">P. unit.</th>
                                <th className="py-1.5 px-3 text-right font-medium">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sale.items?.length ? (
                                sale.items.map((item, idx) => (
                                  <tr
                                    key={`${sale.id}-${idx}`}
                                    className="border-b border-zinc-100 dark:border-zinc-700/40 last:border-0"
                                  >
                                    <td className="py-1.5 px-3 text-zinc-700 dark:text-zinc-300">
                                      {item.product_name}
                                    </td>
                                    <td className="py-1.5 px-3 text-right text-zinc-600 dark:text-zinc-400">
                                      {item.quantity}
                                    </td>
                                    <td className="py-1.5 px-3 text-right text-zinc-600 dark:text-zinc-400">
                                      ${fmt(item.price)}
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-medium text-zinc-800 dark:text-zinc-200">
                                      ${fmt(item.line_total)}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={4} className="py-2 px-3 text-zinc-500 text-xs">
                                    Sin ítems registrados
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                  </>
                )}
                {(detailShift.inventory_movements ?? []).length ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Movimientos de inventario durante el turno
                    </p>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50">
                            <th className="py-1.5 px-3 text-left font-medium">Hora</th>
                            <th className="py-1.5 px-3 text-left font-medium">Tipo</th>
                            <th className="py-1.5 px-3 text-left font-medium">Producto</th>
                            <th className="py-1.5 px-3 text-right font-medium">Cant.</th>
                            <th className="py-1.5 px-3 text-left font-medium">Motivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detailShift.inventory_movements ?? []).map((m) => (
                            <tr key={m.id} className="border-b border-zinc-100 dark:border-zinc-700/40 last:border-0">
                              <td className="py-1.5 px-3 text-zinc-600 dark:text-zinc-400">
                                {formatTime(m.created_at)}
                              </td>
                              <td className="py-1.5 px-3">
                                <span className={m.type === 'RESTOCK' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                  {m.type === 'RESTOCK' ? 'Reingreso' : 'Merma'}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-zinc-700 dark:text-zinc-300">{m.product_name}</td>
                              <td className="py-1.5 px-3 text-right text-zinc-700 dark:text-zinc-300">
                                  {m.type === 'RESTOCK' ? `+${m.quantity}` : `-${m.quantity}`}
                                </td>
                              <td className="py-1.5 px-3 text-zinc-500 text-xs">{m.reason ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setDetailShiftId(null); setDetailShift(null) }}>
                    Cerrar
                  </Button>
                </div>
              </div>
            ) : null}
          </Modal>
        )}

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
                <th className="py-3 px-4 text-right font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton columns={8} rows={8} />
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500">
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
                    <td className="py-2.5 px-4 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="inline-flex items-center gap-1"
                        onClick={() => void openDetail(s.id)}
                        disabled={loadingDetail}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Transacciones
                      </Button>
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
