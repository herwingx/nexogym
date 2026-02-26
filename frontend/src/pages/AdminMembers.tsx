import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  fetchMemberUsers,
  renewSubscription,
  freezeSubscription,
  unfreezeSubscription,
  cancelSubscription,
  type MemberUserRow,
} from '../lib/apiClient'
import { notifyError, notifyPromise } from '../lib/notifications'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { TableRowSkeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'

type MemberStatus = 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'CANCELED'

const STATUS_BADGE: Record<MemberStatus, string> = {
  ACTIVE:
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  FROZEN:
    'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  EXPIRED:
    'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  CANCELED:
    'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
}

const STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: 'Activo',
  FROZEN: 'Congelado',
  EXPIRED: 'Expirado',
  CANCELED: 'Cancelado',
}

function getMemberStatus(row: MemberUserRow): MemberStatus {
  const sub = row.subscriptions?.[0]
  if (!sub) return 'EXPIRED'
  const s = sub.status as string
  if (s === 'ACTIVE') return 'ACTIVE'
  if (s === 'FROZEN') return 'FROZEN'
  if (s === 'CANCELED') return 'CANCELED'
  return 'EXPIRED'
}

const PAGE_SIZE = 20

export const AdminMembers = () => {
  const [members, setMembers] = useState<MemberUserRow[]>([])
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: PAGE_SIZE })
  const [loading, setLoading] = useState(true)
  const [actionTarget, setActionTarget] = useState<{ user: MemberUserRow; action: 'renew' | 'freeze' | 'unfreeze' | 'cancel' } | null>(null)

  const load = async (page = 1) => {
    try {
      setLoading(true)
      const res = await fetchMemberUsers(page, PAGE_SIZE)
      setMembers(res.data)
      setMeta(res.meta)
    } catch (e) {
      notifyError({
        title: 'Error al cargar socios',
        description: (e as Error)?.message ?? 'Intenta de nuevo.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleAction = async () => {
    if (!actionTarget) return
    const { user, action } = actionTarget
    setActionTarget(null)
    try {
      await notifyPromise(
        (async () => {
          if (action === 'renew') await renewSubscription(user.id)
          else if (action === 'freeze') await freezeSubscription(user.id)
          else if (action === 'unfreeze') await unfreezeSubscription(user.id)
          else if (action === 'cancel') await cancelSubscription(user.id)
        })(),
        {
          loading: { title: 'Procesando...' },
          success: () => ({
            title: 'Listo',
            description:
              action === 'renew' ? 'Suscripción renovada' :
              action === 'freeze' ? 'Suscripción congelada' :
              action === 'unfreeze' ? 'Suscripción descongelada' :
              'Suscripción cancelada',
          }),
          error: (err) => ({
            title: 'Error',
            description: (err as Error)?.message ?? 'Intenta de nuevo.',
          }),
        },
      )
      void load(meta.page)
    } catch {
      // notifyPromise handles it
    }
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Socios</h1>
            <p className="text-sm text-zinc-500">
              Directorio de socios del gimnasio ({meta.total} en total).
            </p>
          </div>
        </header>

        <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <th className="py-3 px-4 text-left font-medium">Nombre</th>
                <th className="py-3 px-4 text-left font-medium">Estado</th>
                <th className="py-3 px-4 text-left font-medium">Teléfono</th>
                <th className="py-3 px-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton columns={4} rows={8} />
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-zinc-500">
                    No hay socios registrados.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const status = getMemberStatus(member)
                  return (
                    <tr
                      key={member.id}
                      className="border-t border-zinc-200 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 align-middle text-zinc-900 dark:text-zinc-100 font-medium">
                        {member.name ?? '—'}
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide',
                            STATUS_BADGE[status],
                          )}
                        >
                          {STATUS_LABELS[status]}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-middle text-zinc-500 dark:text-zinc-400">
                        {member.phone ?? '—'}
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <div className="flex flex-wrap justify-end gap-1">
                          {status === 'EXPIRED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActionTarget({ user: member, action: 'renew' })}
                            >
                              Renovar
                            </Button>
                          )}
                          {status === 'ACTIVE' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActionTarget({ user: member, action: 'freeze' })}
                            >
                              Congelar
                            </Button>
                          )}
                          {status === 'FROZEN' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActionTarget({ user: member, action: 'unfreeze' })}
                            >
                              Descongelar
                            </Button>
                          )}
                          {(status === 'ACTIVE' || status === 'FROZEN') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActionTarget({ user: member, action: 'cancel' })}
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
        </div>

        {totalPages > 1 && (
          <div className="flex flex-wrap justify-between items-center gap-3">
            <p className="text-xs text-zinc-500">
              Página {meta.page} de {totalPages}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={meta.page <= 1}
                onClick={() => void load(meta.page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={meta.page >= totalPages}
                onClick={() => void load(meta.page + 1)}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {actionTarget && (
        <Modal
          isOpen
          onClose={() => setActionTarget(null)}
          title={
            actionTarget.action === 'renew' ? 'Renovar suscripción' :
            actionTarget.action === 'freeze' ? 'Congelar suscripción' :
            actionTarget.action === 'unfreeze' ? 'Descongelar suscripción' :
            'Cancelar suscripción'
          }
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            {actionTarget.action === 'renew' &&
              `¿Renovar la membresía de ${actionTarget.user.name ?? 'este socio'} por 30 días?`}
            {actionTarget.action === 'freeze' &&
              `¿Congelar la membresía de ${actionTarget.user.name ?? 'este socio'}?`}
            {actionTarget.action === 'unfreeze' &&
              `¿Descongelar la membresía de ${actionTarget.user.name ?? 'este socio'}?`}
            {actionTarget.action === 'cancel' &&
              `¿Cancelar la membresía de ${actionTarget.user.name ?? 'este socio'}? Esta acción es irreversible.`}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setActionTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleAction}>Confirmar</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
