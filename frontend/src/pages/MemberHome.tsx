import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock, Smartphone } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { fetchMemberProfile, requestMemberQrResend, type MemberProfile } from '../lib/apiClient'
import { notifyError, notifySuccess } from '../lib/notifications'
import { useAuthStore } from '../store/useAuthStore'
import { cn } from '../lib/utils'
import { CardSkeleton, Skeleton } from '../components/ui/Skeleton'

const STATUS_CONFIG = {
  ACTIVE: {
    label: 'Activo',
    icon: CheckCircle2,
    classes:
      'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  EXPIRED: {
    label: 'Expirado',
    icon: XCircle,
    classes:
      'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
  FROZEN: {
    label: 'Congelado',
    icon: Clock,
    classes:
      'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  SUSPENDED: {
    label: 'Suspendido',
    icon: Clock,
    classes:
      'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
}

/** QR único y estable por socio: no rota. Se envía por WhatsApp/n8n; al escanear en recepción = llegada, racha se actualiza sin abrir la web. */
const STABLE_QR_PREFIX = 'GYM_QR_'

const MOCK_PROFILE: MemberProfile = {
  id: 'demo-id',
  name: 'Demo User',
  email: 'demo@nexogym.com',
  membership_status: 'ACTIVE',
  membership_type: 'Mensual Ilimitado',
  expiry_date: '2026-03-31',
  current_streak: 12,
  best_streak: 21,
  total_visits: 47,
  next_reward: {
    label: 'Botella de agua gratis',
    visits_required: 14,
    visits_progress: 12,
  },
}

export const MemberHome = () => {
  const user = useAuthStore((s) => s.user)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendingQr, setSendingQr] = useState(false)

  useEffect(() => {
    fetchMemberProfile()
      .then(setProfile)
      .catch(() => setProfile(MOCK_PROFILE))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="px-4 pt-10 pb-6 max-w-md mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-36" />
          </div>
          <Skeleton className="h-11 w-11 rounded-full shrink-0" />
        </div>
        <CardSkeleton count={1} lines={2} />
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm p-5 flex flex-col items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-52 w-52 rounded-2xl" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    )
  }

  const data = profile ?? MOCK_PROFILE
  const statusKey = (data.membership_status as keyof typeof STATUS_CONFIG) in STATUS_CONFIG
    ? (data.membership_status as keyof typeof STATUS_CONFIG)
    : 'SUSPENDED'
  const statusCfg = STATUS_CONFIG[statusKey]
  const StatusIcon = statusCfg.icon
  const memberId = user?.id ?? data.id
  const qrPayload = data.qr_payload ?? (memberId ? `${STABLE_QR_PREFIX}${memberId}` : '')

  return (
    <div className="px-4 pt-10 pb-6 max-w-md mx-auto space-y-5">
      {/* Saludo */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Bienvenido
          </p>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {user?.name ?? data.name}
          </h1>
        </div>
        {data.profile_picture_url ? (
          <img
            src={data.profile_picture_url}
            alt={data.name}
            className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/30"
          />
        ) : (
          <div className="h-11 w-11 rounded-full bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold">
              {(user?.name ?? data.name).charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Badge de membresía */}
      <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-zinc-500">Membresía</p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {data.membership_type ?? 'Plan estándar'}
          </p>
          {data.expiry_date && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Vence el{' '}
              <span className="text-zinc-700 dark:text-zinc-300">
                {new Date(data.expiry_date).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
            </p>
          )}
        </div>
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
            statusCfg.classes,
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {statusCfg.label}
        </span>
      </div>

      {/* QR gigante — protagonista de la pantalla */}
      <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm p-5 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-zinc-500">
          <Smartphone className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-widest">
            Tu código de acceso
          </span>
        </div>

        {/* QR único estable: mismo que se envía por WhatsApp; al escanear = llegada, se actualiza la racha */}
        <div className="relative bg-white rounded-2xl p-4 shadow-sm">
          <QRCodeSVG
            value={qrPayload}
            size={190}
            bgColor="#ffffff"
            fgColor="#09090b"
            level="H"
            includeMargin={false}
          />
        </div>
        <p className="text-xs text-zinc-500 text-center">
          Código único. Escanéalo en recepción al llegar; no hace falta abrir la app.
        </p>
        <button
          type="button"
          onClick={async () => {
            if (sendingQr) return
            setSendingQr(true)
            try {
              await requestMemberQrResend()
              notifySuccess({
                title: 'Enviado',
                description: 'Si el gym tiene WhatsApp configurado, recibirás tu código en unos segundos.',
              })
            } catch (e) {
              notifyError({
                title: 'No se pudo enviar',
                description: (e as Error)?.message ?? 'Inténtalo de nuevo.',
              })
            } finally {
              setSendingQr(false)
            }
          }}
          disabled={sendingQr}
          className="text-xs text-primary underline underline-offset-2 opacity-90 hover:opacity-100 disabled:opacity-50"
        >
          {sendingQr ? 'Enviando...' : 'Recibir mi QR por WhatsApp'}
        </button>
      </div>
    </div>
  )
}
