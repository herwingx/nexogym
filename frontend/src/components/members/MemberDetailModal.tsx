import { useState, useEffect } from 'react'
import { Flame, History, Send } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { UserDetailLayout, type DetailMetaItem } from '../detail/UserDetailLayout'
import { cn } from '../../lib/utils'
import type { MemberUserRow, MemberDetail } from '../../lib/apiClient'
import {
  PLAN_BARCODE_LABELS,
  fetchMemberDetail,
  sendQrToMember,
  regenerateQr,
} from '../../lib/apiClient'
import { notifyError, notifySuccess, notifyPromise } from '../../lib/notifications'
import { DetailSkeleton } from '../ui/Skeleton'
import { STATUS_BADGE as PALETTE } from '../../lib/statusColors'

type MemberStatus = 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'CANCELED' | 'PENDING_PAYMENT'

const MEMBER_STATUS_BADGE: Record<MemberStatus, string> = {
  ACTIVE: PALETTE.success,
  FROZEN: PALETTE.info,
  EXPIRED: PALETTE.danger,
  CANCELED: PALETTE.neutral,
  PENDING_PAYMENT: PALETTE.warning,
}

const STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: 'Activo',
  FROZEN: 'Congelado',
  EXPIRED: 'Expirado',
  CANCELED: 'Cancelado',
  PENDING_PAYMENT: 'Pendiente de pago',
}

function getMemberStatus(row: MemberUserRow): MemberStatus {
  const sub = row.subscriptions?.[0]
  if (!sub) return 'EXPIRED'
  const s = sub.status as string
  if (s === 'ACTIVE') return 'ACTIVE'
  if (s === 'FROZEN') return 'FROZEN'
  if (s === 'PENDING_PAYMENT') return 'PENDING_PAYMENT'
  if (s === 'CANCELED') return 'CANCELED'
  return 'EXPIRED'
}

export type MemberDetailData = MemberUserRow | {
  id: string
  name: string | null
  phone: string | null
  profile_picture_url?: string | null
  role?: string
  auth_user_id?: string | null
  created_at?: string
  current_streak?: number
  last_visit_at?: string | null
  subscriptions?: Array<{ status: string; expires_at: string; plan_barcode?: string | null }>
}

type Props = {
  member: MemberDetailData
  onClose: () => void
  onEdit: () => void
  canRegenerateQr?: boolean
  hasQrAccess?: boolean
  onRefresh?: () => void
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '—' }
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

const ACCESS_METHOD_LABELS: Record<string, string> = {
  QR: 'QR',
  MANUAL: 'Manual',
  BIOMETRIC: 'Biométrico',
}

export function MemberDetailModal({ member, onClose, onEdit, canRegenerateQr = false, hasQrAccess = true, onRefresh }: Props) {
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendingQr, setSendingQr] = useState(false)
  const [regeneratingQr, setRegeneratingQr] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchMemberDetail(member.id)
      .then((d) => { if (!cancelled) setDetail(d) })
      .catch(() => { if (!cancelled) setDetail(member as MemberDetail) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [member.id])

  const data = detail ?? (member as MemberDetail)
  const status = getMemberStatus(data as MemberUserRow)
  const sub = data.subscriptions?.[0]
  const planLabel = sub?.promotion?.badge ?? (sub?.plan_barcode ? (PLAN_BARCODE_LABELS[sub.plan_barcode] ?? sub.plan_barcode) : 'Mensual')
  const lastVisits = (data as MemberDetail).last_visits ?? []
  const totalVisits = (data as MemberDetail).total_visits ?? 0
  const qrPayload = (data as MemberDetail).qr_payload

  const metaItems: DetailMetaItem[] = [
    { label: 'Miembro desde', value: data.created_at ? formatDate(data.created_at) : '—' },
    { label: 'Teléfono', value: data.phone || '—' },
    { label: 'Plan', value: planLabel },
    { label: 'Acceso portal', value: data.auth_user_id ? 'Sí' : 'No' },
    { label: 'Vence', value: sub?.expires_at ? formatDate(sub.expires_at) : '—' },
    ...(totalVisits > 0 ? [{ label: 'Total visitas', value: String(totalVisits) }] : []),
    ...(data.last_visit_at ? [{ label: 'Última visita', value: formatDateTime(data.last_visit_at) }] : []),
    ...((data.current_streak ?? 0) > 0 ? [{ label: 'Racha', value: <span className="text-primary flex items-center gap-1"><Flame className="h-3.5 w-3.5" />{data.current_streak} días</span> }] : []),
    ...((data as MemberDetail).birth_date ? [{ label: 'Cumpleaños', value: formatDate((data as MemberDetail).birth_date) }] : []),
  ]

  const handleSendQr = async () => {
    setSendingQr(true)
    try {
      await sendQrToMember(member.id)
      notifySuccess({ title: 'QR enviado', description: 'Se envió el código de acceso por WhatsApp.' })
      onRefresh?.()
    } catch (e) {
      notifyError({ title: 'Error al enviar QR', description: (e as Error)?.message ?? 'Intenta de nuevo.' })
    } finally {
      setSendingQr(false)
    }
  }

  const handleRegenerateQr = async () => {
    if (!confirm('¿Regenerar el QR de acceso? El anterior dejará de funcionar.')) return
    setRegeneratingQr(true)
    try {
      await notifyPromise(regenerateQr(member.id, true), {
        loading: { title: 'Regenerando QR...' },
        success: () => ({ title: 'QR regenerado', description: 'Se envió el nuevo código por WhatsApp.' }),
        error: (err) => ({ title: 'Error', description: (err as Error)?.message ?? '' }),
      })
      onRefresh?.()
    } finally {
      setRegeneratingQr(false)
    }
  }

  if (loading) {
    return (
      <Modal isOpen title="Detalle del socio" onClose={onClose}>
        <DetailSkeleton />
      </Modal>
    )
  }

  return (
    <Modal isOpen title="Detalle del socio" onClose={onClose}>
      <UserDetailLayout
        profilePictureUrl={data.profile_picture_url}
        name={data.name || 'Sin nombre'}
        subtitle={data.phone || undefined}
        statusBadge={
          <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', MEMBER_STATUS_BADGE[status])}>
            {STATUS_LABELS[status]}
          </span>
        }
        metaItems={metaItems}
        visitsSection={
          lastVisits.length > 0 ? (
            <div>
              <h4 className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                <History className="h-3.5 w-3.5" />
                Últimas visitas
              </h4>
              <ul className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800 max-h-24 overflow-y-auto text-xs">
                {lastVisits.slice(0, 5).map((v) => (
                  <li key={v.id} className="flex justify-between px-3 py-1.5 text-zinc-700 dark:text-zinc-300">
                    <span>{formatDateTime(v.checked_in_at)}</span>
                    <span className="text-zinc-500">{ACCESS_METHOD_LABELS[v.access_method] ?? v.access_method}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : undefined
        }
        qrSection={
          hasQrAccess && data.phone ? (
            <div className="flex flex-col gap-3">
              {qrPayload && (
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Código para mostrar en recepción si el socio no lleva teléfono</p>
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white p-3">
                    <QRCodeSVG value={qrPayload} size={96} level="M" />
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleSendQr} disabled={sendingQr}>
                  <Send className="h-3.5 w-3.5" />
                  Enviar QR
                </Button>
                {canRegenerateQr && (
                  <Button size="sm" variant="outline" onClick={handleRegenerateQr} disabled={regeneratingQr}>
                    Regenerar QR
                  </Button>
                )}
              </div>
            </div>
          ) : undefined
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
            <Button size="sm" onClick={onEdit}>Editar</Button>
          </>
        }
      />
    </Modal>
  )
}
