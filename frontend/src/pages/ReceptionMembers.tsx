import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, User, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { EditMemberForm } from '../components/members/EditMemberForm'
import { MemberDetailModal, type MemberDetailData } from '../components/members/MemberDetailModal'
import {
  searchMembers,
  fetchMemberUsers,
  renewSubscription,
  freezeSubscription,
  unfreezeSubscription,
  cancelSubscription,
  PLAN_BARCODE_LABELS,
  type MemberSummary,
  type MemberUserRow,
} from '../lib/apiClient'
import { notifyError, notifySuccess } from '../lib/notifications'
import { useAuthStore } from '../store/useAuthStore'
import { cn } from '../lib/utils'
import { TableRowSkeleton, ListSkeleton } from '../components/ui/Skeleton'
import { Input } from '../components/ui/Input'
import { STATUS_BADGE as PALETTE } from '../lib/statusColors'

const PAGE_SIZE = 20

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: PALETTE.success,
  FROZEN: PALETTE.info,
  EXPIRED: PALETTE.danger,
  CANCELED: PALETTE.neutral,
  PENDING_PAYMENT: PALETTE.warning,
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  FROZEN: 'Congelado',
  EXPIRED: 'Vencido',
  CANCELED: 'Cancelado',
  PENDING_PAYMENT: 'Pendiente de pago',
}

function getMemberStatus(row: MemberUserRow): string {
  const sub = row.subscriptions?.[0]
  if (!sub) return 'EXPIRED'
  const s = sub.status as string
  if (s === 'ACTIVE') return 'ACTIVE'
  if (s === 'FROZEN') return 'FROZEN'
  if (s === 'PENDING_PAYMENT') return 'PENDING_PAYMENT'
  if (s === 'CANCELED') return 'CANCELED'
  return 'EXPIRED'
}

export const ReceptionMembersPage = () => {
  const navigate = useNavigate()
  const hasQrAccess = useAuthStore((s) => s.modulesConfig?.qr_access)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MemberSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [members, setMembers] = useState<MemberUserRow[]>([])
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; expiring_7d?: number; expired?: number }>({ total: 0, page: 1, limit: PAGE_SIZE })
  const [loading, setLoading] = useState(true)
  const [detailMember, setDetailMember] = useState<MemberDetailData | null>(null)
  const [editMember, setEditMember] = useState<MemberSummary | null>(null)
  const [actionTarget, setActionTarget] = useState<{ user: MemberUserRow; action: 'renew' | 'freeze' | 'unfreeze' | 'cancel' } | null>(null)
  const [renewPlanBarcode, setRenewPlanBarcode] = useState<string>('MEMBERSHIP')
  const [cancelReason, setCancelReason] = useState('')
  const [cancelRefundAmount, setCancelRefundAmount] = useState<string>('')
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const canRegenerateQr = useAuthStore((s) =>
    s.user?.role === 'ADMIN' || s.user?.role === 'SUPERADMIN' || s.user?.effective_staff_permissions?.can_regenerate_member_qr === true
  )

  useEffect(() => {
    if (actionTarget?.action === 'renew' && actionTarget.user?.subscriptions?.[0]?.plan_barcode && actionTarget.user.subscriptions[0].plan_barcode in PLAN_BARCODE_LABELS) {
      setRenewPlanBarcode(actionTarget.user.subscriptions[0].plan_barcode)
    } else if (actionTarget?.action === 'renew') {
      setRenewPlanBarcode('MEMBERSHIP')
    }
  }, [actionTarget?.action, actionTarget?.user?.id, actionTarget?.user?.subscriptions?.[0]?.plan_barcode])

  const loadList = async (page = 1) => {
    try {
      setLoading(true)
      const res = await fetchMemberUsers(page, PAGE_SIZE, 'name')
      setMembers(res.data)
      setMeta(res.meta)
    } catch (e) {
      notifyError({ title: 'Error al cargar socios', description: (e as Error)?.message ?? '' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadList()
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchMembers(query)
        setSearchResults(data)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const showSearch = query.trim().length >= 2

  const handleDetailEdit = () => {
    if (!detailMember) return
    setEditMember({
      id: detailMember.id,
      name: detailMember.name ?? '',
      phone: detailMember.phone ?? '',
      profile_picture_url: detailMember.profile_picture_url ?? null,
      role: (detailMember as { role?: string }).role ?? 'MEMBER',
      auth_user_id: detailMember.auth_user_id ?? null,
    })
    setDetailMember(null)
  }

  const handleAction = async () => {
    if (!actionTarget) return
    const { user, action } = actionTarget
    setActionSubmitting(true)
    try {
      if (action === 'renew') {
        const res = await renewSubscription(user.id, { barcode: renewPlanBarcode })
        const amt = res.amount_registered_in_shift
        if (typeof amt === 'number' && amt > 0) {
          notifySuccess({
            title: 'Renovado',
            description: `Suscripción renovada. $${amt.toFixed(2)} registrado en caja.`,
          })
        } else {
          notifySuccess({
            title: 'Renovado',
            description:
              'Suscripción renovada. El precio está en $0; no se registró cobro en caja. Si quieres registrar el pago, configura el precio en Inventario (Membresía 30 días).',
          })
        }
      } else if (action === 'freeze') {
        await freezeSubscription(user.id)
        notifySuccess({ title: 'Congelado', description: 'Suscripción congelada.' })
      } else if (action === 'unfreeze') {
        await unfreezeSubscription(user.id)
        notifySuccess({ title: 'Descongelado', description: 'Suscripción descongelada.' })
      } else if (action === 'cancel') {
        const res = await cancelSubscription(user.id, {
          reason: cancelReason,
          refund_amount: cancelRefundAmount ? Number(cancelRefundAmount) : undefined,
        })
        if (res.refund_registered && res.refund_registered > 0) {
          notifySuccess({
            title: 'Cancelado',
            description: `Suscripción cancelada. $${res.refund_registered.toFixed(2)} registrado como devolución en caja.`,
          })
        } else {
          notifySuccess({ title: 'Cancelado', description: 'Suscripción cancelada.' })
        }
      }
      setActionTarget(null)
      setCancelReason('')
      setCancelRefundAmount('')
      void loadList(meta.page)
      if (editMember?.id === user.id) setEditMember(null)
      if (detailMember?.id === user.id) setDetailMember(null)
    } catch (e) {
      notifyError({ title: 'Error', description: (e as Error)?.message ?? '' })
    } finally {
      setActionSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-background text-foreground px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Socios
            </h1>
            <p className="text-sm text-zinc-500">
              Buscar o listar socios. Editar nombre, teléfono o foto.
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/reception/members/new')}>
            <UserPlus className="h-4 w-4 mr-1" />
            Nuevo socio
          </Button>
        </div>

        {/* Resumen: próximos a vencer y vencidos */}
        {(meta.expiring_7d != null || meta.expired != null) && (
          <div className="flex flex-wrap gap-3 text-sm">
            {meta.expiring_7d != null && meta.expiring_7d > 0 && (
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-700 dark:text-amber-400">
                {meta.expiring_7d} por vencer (7 días)
              </span>
            )}
            {meta.expired != null && meta.expired > 0 && (
              <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-rose-600 dark:text-rose-400">
                {meta.expired} vencidos
              </span>
            )}
          </div>
        )}

        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre o teléfono (mín. 2 caracteres)"
            className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 py-2.5 pl-10 pr-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>

        {/* Resultados de búsqueda */}
        {showSearch && (
          <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 overflow-hidden">
            {searching ? (
              <ListSkeleton count={4} />
            ) : searchResults.length === 0 ? (
              <p className="px-4 py-3 text-sm text-zinc-500">Sin resultados</p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {searchResults.map((m) => {
                  const full = members.find((x) => x.id === m.id)
                  const detailData: MemberDetailData = full ?? m
                  const status = full ? getMemberStatus(full) : null
                  return (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setDetailMember(detailData)}
                      className="flex flex-1 min-w-0 items-center gap-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 -mx-2 -my-1.5 px-2 py-1.5 rounded-md transition-colors"
                    >
                      {m.profile_picture_url ? (
                        <img
                          src={m.profile_picture_url}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover border border-zinc-200 dark:border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-zinc-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {m.name || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">{m.phone}</p>
                      </div>
                    </button>
                    {full && status && (
                      <div className="flex flex-wrap gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {(status === 'PENDING_PAYMENT' || status === 'EXPIRED' || status === 'CANCELED' || status === 'ACTIVE') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActionTarget({ user: full, action: 'renew' })}
                          >
                            {status === 'PENDING_PAYMENT' ? 'Pagar' : 'Renovar'}
                          </Button>
                        )}
                        {status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActionTarget({ user: full, action: 'freeze' })}
                          >
                            Congelar
                          </Button>
                        )}
                        {status === 'FROZEN' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActionTarget({ user: full, action: 'renew' })}
                            >
                              Renovar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActionTarget({ user: full, action: 'unfreeze' })}
                            >
                              Descongelar
                            </Button>
                          </>
                        )}
                        {(status === 'ACTIVE' || status === 'FROZEN') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActionTarget({ user: full, action: 'cancel' })}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {/* Listado paginado (cuando no hay búsqueda activa) */}
        {!showSearch && (
          <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                  <th className="py-3 px-4 text-left font-medium">Nombre</th>
                  <th className="py-3 px-4 text-left font-medium">Teléfono</th>
                  <th className="py-3 px-4 text-left font-medium">Estado</th>
                  <th className="py-3 px-4 text-left font-medium">Plan</th>
                  <th className="py-3 px-4 text-left font-medium">Vence</th>
                  <th className="py-3 px-4 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableRowSkeleton columns={6} rows={8} />
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      No hay socios registrados.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => {
                    const status = getMemberStatus(m)
                    const sub = m.subscriptions?.[0]
                    const expiresAt = sub?.expires_at ? new Date(sub.expires_at) : null
                    return (
                      <tr
                        key={m.id}
                        className="border-t border-zinc-200 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <td className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={() => setDetailMember(m)}
                            className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity min-w-0"
                          >
                            {m.profile_picture_url ? (
                              <img
                                src={m.profile_picture_url}
                                alt=""
                                className="h-9 w-9 rounded-full object-cover border border-zinc-200 dark:border-white/10 shrink-0"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0 border border-zinc-200/80 dark:border-white/10">
                                <User className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                              </div>
                            )}
                            <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {m.name ?? '—'}
                            </span>
                          </button>
                        </td>
                        <td className="py-2.5 px-4 text-zinc-700 dark:text-zinc-300 truncate max-w-[120px]">
                          {m.phone ?? '—'}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                              STATUS_BADGE[status] ?? STATUS_BADGE.CANCELED,
                            )}
                          >
                            {STATUS_LABELS[status] ?? status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                            {sub?.promotion?.badge ?? (sub?.plan_barcode ? (PLAN_BARCODE_LABELS[sub.plan_barcode] ?? sub.plan_barcode) : 'Mensual')}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400 text-xs">
                          {expiresAt ? expiresAt.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex flex-wrap justify-end gap-1">
                            {(status === 'PENDING_PAYMENT' || status === 'EXPIRED' || status === 'CANCELED' || status === 'ACTIVE') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setActionTarget({ user: m, action: 'renew' })}
                              >
                                {status === 'PENDING_PAYMENT' ? 'Pagar' : 'Renovar'}
                              </Button>
                            )}
                            {status === 'ACTIVE' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setActionTarget({ user: m, action: 'freeze' })}
                              >
                                Congelar
                              </Button>
                            )}
                            {status === 'FROZEN' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setActionTarget({ user: m, action: 'renew' })}
                                >
                                  Renovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setActionTarget({ user: m, action: 'unfreeze' })}
                                >
                                  Descongelar
                                </Button>
                              </>
                            )}
                            {(status === 'ACTIVE' || status === 'FROZEN') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setActionTarget({ user: m, action: 'cancel' })}
                              >
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            {meta.total > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <span>
                  {members.length} de {meta.total}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => loadList(meta.page - 1)}
                    disabled={meta.page <= 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => loadList(meta.page + 1)}
                    disabled={meta.page * meta.limit >= meta.total || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {actionTarget && (
        <Modal
          isOpen
          onClose={() => {
            if (!actionSubmitting) {
              setActionTarget(null)
              setRenewPlanBarcode('MEMBERSHIP')
              setCancelReason('')
              setCancelRefundAmount('')
            }
          }}
          title={
            actionTarget.action === 'renew'
              ? 'Renovar suscripción'
              : actionTarget.action === 'freeze'
                ? 'Congelar suscripción'
                : actionTarget.action === 'unfreeze'
                  ? 'Descongelar suscripción'
                  : 'Cancelar suscripción'
          }
        >
          {actionTarget.action === 'renew' ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Renovar a <strong>{actionTarget.user.name ?? actionTarget.user.phone ?? 'este socio'}</strong>. El cobro usa el precio del plan elegido en Inventario. Requiere turno abierto para registrar el pago.
              </p>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Plan</label>
                <select
                  value={renewPlanBarcode}
                  onChange={(e) => setRenewPlanBarcode(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 py-2 px-3"
                >
                  {Object.entries(PLAN_BARCODE_LABELS).map(([barcode, label]) => (
                    <option key={barcode} value={barcode}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActionTarget(null)}
                  disabled={actionSubmitting}
                >
                  Cancelar
                </Button>
                <Button onClick={handleAction} disabled={actionSubmitting}>
                  {actionSubmitting ? 'Procesando...' : 'Renovar'}
                </Button>
              </div>
            </div>
          ) : actionTarget.action === 'cancel' ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Cancelar la membresía de {actionTarget.user.name ?? actionTarget.user.phone ?? 'este socio'}. Indica el motivo y opcionalmente el monto a devolver (requiere turno abierto).
              </p>
              <Input
                label="Motivo (obligatorio)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej: Devolución, cambio de domicilio, arrepentimiento"
                minLength={3}
              />
              <Input
                label="Monto a devolver (opcional)"
                type="number"
                min={0}
                step="0.01"
                value={cancelRefundAmount}
                onChange={(e) => setCancelRefundAmount(e.target.value)}
                placeholder="Ej: 500"
                helperText="Si indicas monto, se registrará como egreso en caja. Requiere turno abierto."
              />
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setActionTarget(null); setCancelReason(''); setCancelRefundAmount('') }}
                  disabled={actionSubmitting}
                >
                  Cerrar
                </Button>
                <Button
                  onClick={handleAction}
                  disabled={actionSubmitting || !cancelReason.trim() || cancelReason.trim().length < 3}
                >
                  {actionSubmitting ? 'Procesando...' : 'Cancelar membresía'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {actionTarget.action === 'freeze'
                  ? `¿Congelar la suscripción de ${actionTarget.user.name ?? actionTarget.user.phone ?? 'este socio'}?`
                  : `¿Descongelar la suscripción de ${actionTarget.user.name ?? actionTarget.user.phone ?? 'este socio'}?`}
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActionTarget(null)}
                  disabled={actionSubmitting}
                >
                  Cerrar
                </Button>
                <Button onClick={handleAction} disabled={actionSubmitting}>
                  {actionSubmitting ? 'Procesando...' : actionTarget.action === 'freeze' ? 'Congelar' : 'Descongelar'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {detailMember && (
        <MemberDetailModal
          member={detailMember}
          onClose={() => setDetailMember(null)}
          onEdit={handleDetailEdit}
          canRegenerateQr={canRegenerateQr}
          hasQrAccess={hasQrAccess ?? false}
          onRefresh={() => void loadList(meta.page)}
        />
      )}

      {editMember && (
        <Modal isOpen title="Editar socio" onClose={() => setEditMember(null)}>
          <EditMemberForm
            member={editMember}
            onSuccess={() => {
              setEditMember(null)
              void loadList(meta.page)
            }}
            onCancel={() => setEditMember(null)}
            canRegenerateQr={canRegenerateQr}
          />
        </Modal>
      )}
    </div>
  )
}
