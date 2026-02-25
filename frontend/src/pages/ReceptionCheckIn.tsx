import { useEffect, useState, useCallback } from 'react'
import { Camera, Keyboard } from 'lucide-react'
import { sileo } from 'sileo'
import {
  submitCheckin,
  submitCourtesyCheckin,
  fetchOccupancy,
  fetchCurrentShift,
  type CheckinSuccessResponse,
  type CheckinForbiddenPayload,
  type CurrentShiftResponse,
} from '../lib/apiClient'
import { CardSkeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { HardwareScanner } from '../components/reception/HardwareScanner'
import { CheckInModal, type CheckInModalState } from '../components/reception/CheckInModal'
import { FormOpenShift, FormCloseShift } from '../components/reception/ShiftForms'
import { Button } from '../components/ui/Button'
import { useAuthStore } from '../store/useAuthStore'

type CheckinResult = CheckinSuccessResponse | null
type ModalState = {
  state: CheckInModalState
  userName?: string | null
  userPhotoUrl?: string | null
  message?: string
  newStreak?: number
  userId?: string
}

export const ReceptionCheckInPage = () => {
  const user = useAuthStore((s) => s.user)
  const [buffer, setBuffer] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [occupancy, setOccupancy] = useState<{ current_count: number; capacity: number } | null>(null)
  const [shift, setShift] = useState<CurrentShiftResponse | null>(null)
  const [openShiftModal, setOpenShiftModal] = useState(false)
  const [closeShiftModal, setCloseShiftModal] = useState(false)
  const [lastResult, setLastResult] = useState<CheckinResult>(null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const loadShift = useCallback(async () => {
    try {
      const sh = await fetchCurrentShift().catch(() => null)
      setShift(sh ?? null)
    } catch {
      setShift(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [occ, sh] = await Promise.all([
          fetchOccupancy().catch(() => null),
          fetchCurrentShift().catch(() => null),
        ])
        if (!cancelled) {
          setOccupancy(occ ?? null)
          setShift(sh ?? null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = useCallback(async (qrCode: string) => {
    const code = qrCode.trim()
    if (!code) return
    if (isProcessing) return
    setIsProcessing(true)
    setBuffer('')

    const checkInRequest = () => submitCheckin(code, 'QR')

    try {
      const res = await sileo.promise(checkInRequest(), {
        loading: { title: 'Validando acceso...' },
        success: () => ({ title: 'Check-in procesado' }),
        error: (err: unknown) => ({
          title: 'Error de acceso',
          description: (err as Error)?.message ?? 'No se pudo procesar el check-in.',
        }),
      })
      setLastResult(res)

      if (res.streak_updated) {
        sileo.success({ title: '¡Racha aumentada! 🔥' })
        setModal({
          state: 'streak',
          userName: res.user.name,
          userPhotoUrl: res.user.profile_picture_url ?? null,
          message: res.message,
          newStreak: res.newStreak,
        })
      } else {
        setModal({
          state: 'granted',
          userName: res.user.name,
          userPhotoUrl: res.user.profile_picture_url ?? null,
          message: res.message,
          newStreak: res.newStreak,
        })
      }
    } catch (err) {
      const error = err as Error & { payload?: CheckinForbiddenPayload }
      const payload = error.payload

      if (error.message.includes('Anti-Passback') || error.message.includes('ya fue utilizado')) {
        sileo.error({
          title: 'Acceso Denegado',
          description: 'El pase fue utilizado recientemente.',
          fill: '#171717',
          styles: { title: 'text-white!', description: 'text-white/75!' },
        })
        setModal({
          state: 'antipassback',
          userName: null,
          userPhotoUrl: null,
          message: error.message,
        })
        return
      }

      if (
        payload?.code === 'NO_ACTIVE_SUBSCRIPTION' ||
        error.message.includes('No active subscription') ||
        error.message.toLowerCase().includes('suscripción') ||
        error.message.toLowerCase().includes('membresía')
      ) {
        setModal({
          state: 'debtor',
          userName: payload?.user?.name ?? null,
          userPhotoUrl: payload?.user?.profile_picture_url ?? null,
          message: 'Membresía vencida o inactiva.',
          userId: payload?.user_id,
        })
        return
      }

      setModal({
        state: 'antipassback',
        message: error.message,
      })
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing])

  const handleCourtesyRequest = useCallback(async (userId: string) => {
    try {
      await submitCourtesyCheckin(userId)
      sileo.warning({ title: 'Acceso de cortesía registrado' })
    } catch (e) {
      sileo.error({
        title: 'Error',
        description: (e as Error).message,
      })
    }
  }, [])

  const modalOpen = modal !== null

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-6rem)] bg-background text-foreground p-4 md:p-6">
        <div className="w-full max-w-5xl mx-auto grid gap-4 md:grid-cols-[7fr_3fr]">
          <CardSkeleton count={1} lines={3} className="min-h-[200px]" />
          <div className="space-y-4">
            <CardSkeleton count={1} lines={2} />
            <CardSkeleton count={1} lines={4} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-background text-foreground p-4 md:p-6">
      <HardwareScanner
        value={buffer}
        onChange={setBuffer}
        onSubmit={handleSubmit}
        pauseFocus={modalOpen}
        refocusDelayMs={100}
      />

      <div className="w-full max-w-5xl mx-auto grid gap-4 md:grid-cols-[7fr_3fr]">
        {/* Columna izquierda ~70%: Check-in + perfil último socio */}
        <section className="space-y-4">
          <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Check-in rápido
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Escáner USB como teclado. Solo apunta y dispara.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-1 text-[11px] text-zinc-500">
                <Keyboard className="h-3.5 w-3.5" />
                Foco infinito
              </span>
            </div>

            <div className="mt-6 space-y-3 text-xs text-zinc-500">
              <p>
                El lector QR USB escribe el código completo seguido de{' '}
                <span className="font-mono text-zinc-700 dark:text-zinc-300">Enter</span>. Este
                panel captura y procesa cada lectura sin que el recepcionista tenga que tocar nada.
              </p>
            </div>

            <div className="mt-4">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-white/10 bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-500 transition-colors"
                onClick={() =>
                  sileo.info({
                    title: 'Cámara',
                    description: 'En un sprint posterior integraremos html5-qrcode como opción secundaria.',
                  })
                }
              >
                <Camera className="h-3.5 w-3.5" />
                Usar cámara
              </button>
            </div>
          </div>

          {/* Último check-in / perfil del socio */}
          <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-3">
              Último check-in
            </h2>
            {lastResult ? (
              <div className="flex items-center gap-3">
                {lastResult.user.profile_picture_url ? (
                  <img
                    src={lastResult.user.profile_picture_url}
                    alt={lastResult.user.name}
                    className="h-12 w-12 rounded-full object-cover border border-zinc-200 dark:border-white/10"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {lastResult.user.name}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{lastResult.message}</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  Racha: <span className="font-semibold ml-1">{lastResult.newStreak}</span>
                </span>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                Aún no hay check-ins en esta sesión. El próximo escaneo mostrará aquí los datos del
                socio.
              </p>
            )}
          </div>
        </section>

        {/* Columna derecha ~30%: Semáforo aforo + Turno caja */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              Aforo actual
            </h3>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {occupancy?.current_count ?? 0}
              <span className="text-sm font-normal text-zinc-500 ml-1">
                / {occupancy?.capacity ?? 0}
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              Turno de caja
            </h3>
            {shift ? (
              <>
                <p className="text-xs text-zinc-500">
                  Abierto: {new Date(shift.shift.opened_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}{' '}
                  · Fondo: ${Number(shift.shift.opening_balance).toFixed(2)}
                </p>
                <div className="mt-3 space-y-1 text-sm">
                  <p className="text-emerald-600 dark:text-emerald-400">
                    Ventas: +${Number(shift.running_totals.total_sales).toFixed(2)}
                  </p>
                  <p className="text-rose-600 dark:text-rose-400">
                    Egresos: -${Number(shift.running_totals.total_expenses).toFixed(2)}
                  </p>
                </div>
                {user?.role !== 'RECEPTIONIST' && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Esperado: ${Number(shift.running_totals.expected_balance).toFixed(2)}
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  size="sm"
                  onClick={() => setCloseShiftModal(true)}
                >
                  Cerrar turno
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-zinc-500">No hay turno abierto.</p>
                <Button className="w-full mt-4" size="sm" onClick={() => setOpenShiftModal(true)}>
                  Abrir turno
                </Button>
              </>
            )}
          </div>
        </aside>
      </div>

      {modal && (
        <CheckInModal
          isOpen
          onClose={() => setModal(null)}
          state={modal.state}
          userName={modal.userName}
          userPhotoUrl={modal.userPhotoUrl}
          message={modal.message}
          newStreak={modal.newStreak}
          userId={modal.userId}
          onCourtesyRequest={modal.userId ? handleCourtesyRequest : undefined}
          noAutoClose={modal.state === 'debtor'}
        />
      )}

      {openShiftModal && (
        <Modal isOpen title="Abrir turno" onClose={() => setOpenShiftModal(false)}>
          <FormOpenShift
            onSuccess={() => {
              setOpenShiftModal(false)
              void loadShift()
            }}
            onCancel={() => setOpenShiftModal(false)}
          />
        </Modal>
      )}
      {closeShiftModal && shift?.running_totals != null && (
        <Modal isOpen title="Cerrar turno" onClose={() => setCloseShiftModal(false)}>
          <FormCloseShift
            expected={shift.running_totals.expected_balance}
            showExpectedBalance={user?.role !== 'RECEPTIONIST'}
            onSuccess={() => {
              setCloseShiftModal(false)
              void loadShift()
            }}
            onCancel={() => setCloseShiftModal(false)}
          />
        </Modal>
      )}
    </div>
  )
}
