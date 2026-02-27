import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuthStore } from '../store/useAuthStore'
import { Smartphone } from 'lucide-react'
import { Skeleton } from '../components/ui/Skeleton'
import { requestMemberQrResend } from '../lib/apiClient'
import { notifyError, notifySuccess } from '../lib/notifications'

/** Mismo formato que n8n/WhatsApp: QR único y estable por socio; no rota. Al escanear = llegada, racha se actualiza. */
const STABLE_QR_PREFIX = 'GYM_QR_'

export const MemberQR = () => {
  const user = useAuthStore((s) => s.user)
  const [sendingQr, setSendingQr] = useState(false)

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-8">
        <div className="text-center space-y-2">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
        <Skeleton className="h-52 w-52 rounded-2xl" />
        <div className="text-center space-y-2">
          <Skeleton className="h-5 w-24 mx-auto" />
          <Skeleton className="h-3 w-16 mx-auto" />
        </div>
      </div>
    )
  }

  const qrPayload = `${STABLE_QR_PREFIX}${user.id}`

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-8">
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2 text-zinc-400 mb-1">
          <Smartphone className="h-4 w-4" />
          <span className="text-xs uppercase tracking-widest font-medium">
            Tu código de acceso
          </span>
        </div>
        <h1 className="text-xl font-bold text-foreground">Muéstralo en recepción</h1>
        <p className="text-sm text-zinc-500">
          Al escanear registras tu llegada y se actualiza tu racha. No hace falta abrir la app.
        </p>
      </div>

      <div className="relative bg-white rounded-2xl p-6 shadow-2xl">
        <QRCodeSVG
          value={qrPayload}
          size={220}
          bgColor="#ffffff"
          fgColor="#09090b"
          level="H"
          includeMargin={false}
        />
      </div>

      <div className="text-center space-y-1">
        <p className="font-semibold text-foreground">{user.name}</p>
        <p className="text-xs text-zinc-500">{user.email}</p>
      </div>
      <p className="text-xs text-zinc-500 text-center max-w-xs">
        Código único; no cambia. Puedes guardarlo o recibirlo por WhatsApp.
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
            notifyError({ title: 'No se pudo enviar', description: (e as Error)?.message ?? '' })
          } finally {
            setSendingQr(false)
          }
        }}
        disabled={sendingQr}
        className="text-sm text-primary font-medium underline underline-offset-2 opacity-90 hover:opacity-100 disabled:opacity-50"
      >
        {sendingQr ? 'Enviando...' : 'Recibir mi QR por WhatsApp'}
      </button>
    </div>
  )
}
