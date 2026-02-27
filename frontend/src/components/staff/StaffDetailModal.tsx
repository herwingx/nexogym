import { useState, useEffect } from 'react'
import { History, Send, Key, UserX } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { UserDetailLayout, type DetailMetaItem } from '../detail/UserDetailLayout'
import type { StaffUserRow, StaffDetail } from '../../lib/apiClient'
import { fetchStaffDetail, sendQrToMember, regenerateQr, resetStaffPassword } from '../../lib/apiClient'
import { notifyError, notifySuccess, notifyPromise } from '../../lib/notifications'
import { DetailSkeleton } from '../ui/Skeleton'
import { cn } from '../../lib/utils'
import { STATUS_BADGE as PALETTE, STATUS_BUTTON_DANGER_OUTLINE } from '../../lib/statusColors'

const ROLE_LABELS: Record<string, string> = {
  RECEPTIONIST: 'Recepción',
  COACH: 'Coach',
  INSTRUCTOR: 'Instructor',
  CLEANER: 'Limpieza',
  ADMIN: 'Admin',
}

const ACCESS_METHOD_LABELS: Record<string, string> = {
  QR: 'QR',
  MANUAL: 'Manual',
  BIOMETRIC: 'Biométrico',
}

const STAFF_ROLES = ['RECEPTIONIST', 'COACH', 'INSTRUCTOR', 'CLEANER'] as const

type Props = {
  staff: StaffUserRow
  onClose: () => void
  onPermissions: () => void
  onCredentials?: () => void
  onDeactivate?: () => void
  canRegenerateQr?: boolean
  canDeactivate?: boolean
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

export function StaffDetailModal({
  staff,
  onClose,
  onPermissions,
  onCredentials,
  onDeactivate,
  canRegenerateQr = false,
  canDeactivate = false,
  hasQrAccess = true,
  onRefresh,
}: Props) {
  const [detail, setDetail] = useState<StaffDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendingQr, setSendingQr] = useState(false)
  const [regeneratingQr, setRegeneratingQr] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchStaffDetail(staff.id)
      .then((d) => { if (!cancelled) setDetail(d) })
      .catch(() => { if (!cancelled) setDetail(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [staff.id])

  const data = detail ?? staff
  const lastVisits = (data as StaffDetail).last_visits ?? []
  const totalVisits = (data as StaffDetail).total_visits ?? 0
  const qrPayload = (data as StaffDetail).qr_payload
  const isInactive = Boolean(data.deleted_at)

  const metaItems: DetailMetaItem[] = [
    { label: 'Fecha de alta', value: data.created_at ? formatDate(data.created_at) : '—' },
    { label: 'Teléfono', value: data.phone || '—' },
    { label: 'Acceso portal', value: data.auth_user_id ? 'Sí' : 'No' },
    ...(totalVisits > 0 ? [{ label: 'Total checadas', value: String(totalVisits) }] : []),
    ...((data as StaffDetail).last_visit_at
      ? [{ label: 'Última checada', value: formatDateTime((data as StaffDetail).last_visit_at) }]
      : []),
  ]

  const handleSendQr = async () => {
    if (!data.phone) {
      notifyError({ title: 'Sin teléfono', description: 'Este personal no tiene teléfono para enviar el QR.' })
      return
    }
    setSendingQr(true)
    try {
      await sendQrToMember(staff.id)
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
      await notifyPromise(regenerateQr(staff.id, true), {
        loading: { title: 'Regenerando QR...' },
        success: () => ({ title: 'QR regenerado', description: 'Se envió el nuevo código por WhatsApp.' }),
        error: (err) => ({ title: 'Error', description: (err as Error)?.message ?? '' }),
      })
      onRefresh?.()
      if (detail) {
        const updated = await fetchStaffDetail(staff.id)
        setDetail(updated)
      }
    } finally {
      setRegeneratingQr(false)
    }
  }

  const handleResetPassword = async () => {
    setResettingPassword(true)
    try {
      await resetStaffPassword(staff.id)
      notifySuccess({ title: 'Contraseña reseteada', description: 'La nueva contraseña se envió al correo del admin.' })
      onRefresh?.()
    } catch (e) {
      notifyError({ title: 'Error al resetear', description: (e as Error)?.message ?? '' })
    } finally {
      setResettingPassword(false)
    }
  }

  if (loading) {
    return (
      <Modal isOpen title="Detalle del personal" onClose={onClose}>
        <DetailSkeleton />
      </Modal>
    )
  }

  return (
    <Modal isOpen title="Detalle del personal" onClose={onClose}>
      <UserDetailLayout
        profilePictureUrl={(data as StaffDetail).profile_picture_url}
        name={data.name || 'Sin nombre'}
        subtitle={ROLE_LABELS[data.role] ?? data.role}
        statusBadge={
          isInactive ? (
            <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium', PALETTE.inactive)}>
              INACTIVO
            </span>
          ) : undefined
        }
        metaItems={metaItems}
        visitsSection={
          lastVisits.length > 0 ? (
            <div>
              <h4 className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                <History className="h-3.5 w-3.5" />
                Últimas checadas
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
          hasQrAccess && qrPayload && !isInactive ? (
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white p-2 shrink-0">
                <QRCodeSVG value={qrPayload} size={96} level="M" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleSendQr} disabled={sendingQr || !data.phone}>
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
            {STAFF_ROLES.includes(data.role as (typeof STAFF_ROLES)[number]) && !isInactive && (
              <Button variant="outline" size="sm" onClick={onPermissions}>
                Permisos
              </Button>
            )}
            {data.auth_user_id && onCredentials && !isInactive && (
              <Button variant="outline" size="sm" onClick={onCredentials}>
                Ver credenciales
              </Button>
            )}
            {data.auth_user_id && !isInactive && (
              <Button variant="outline" size="sm" onClick={handleResetPassword} disabled={resettingPassword}>
                <Key className="h-3.5 w-3.5" />
                {resettingPassword ? '...' : 'Resetear contraseña'}
              </Button>
            )}
            {canDeactivate && onDeactivate && data.role !== 'ADMIN' && data.role !== 'SUPERADMIN' && !isInactive && (
              <Button variant="outline" size="sm" className={STATUS_BUTTON_DANGER_OUTLINE} onClick={onDeactivate}>
                <UserX className="h-3.5 w-3.5" />
                Dar de baja
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </>
        }
      />
    </Modal>
  )
}
