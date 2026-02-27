import { useEffect, useState, useCallback } from 'react'
import { Camera, ScanLine } from 'lucide-react'
import { sileo } from 'sileo'
import {
  submitCheckin,
  submitCourtesyCheckin,
  fetchOccupancy,
  fetchCurrentShift,
  fetchVisits,
  type CheckinSuccessResponse,
  type CheckinForbiddenPayload,
  type CurrentShiftResponse,
  type VisitRow,
} from '../lib/apiClient'
import { CardSkeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { HardwareScanner } from '../components/reception/HardwareScanner'
import { CameraScanner } from '../components/reception/CameraScanner'
import { CheckInModal, type CheckInModalState } from '../components/reception/CheckInModal'
import { FormOpenShift, FormCloseShift } from '../components/reception/ShiftForms'
import { Button } from '../components/ui/Button'
import { useAuthStore } from '../store/useAuthStore'
import { STATUS_BADGE } from '../lib/statusColors'

type CheckinResult = CheckinSuccessResponse | null
type ModalState = {
  state: CheckInModalState
  userName?: string | null
  userPhotoUrl?: string | null
  message?: string
  newStreak?: number
  userId?: string
  debtorBadge?: string
  debtorBadgeVariant?: 'danger' | 'info'
}

export const ReceptionCheckInPage = () => {
  const user = useAuthStore((s) => s.user)
  const qrAccess = useAuthStore((s) => s.modulesConfig.qr_access)
  const [buffer, setBuffer] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [occupancy, setOccupancy] = useState<{ current_count: number; capacity: number } | null>(null)
  const [shift, setShift] = useState<CurrentShiftResponse | null>(null)
  const [openShiftModal, setOpenShiftModal] = useState(false)
  const [closeShiftModal, setCloseShiftModal] = useState(false)
  const [lastResult, setLastResult] = useState<CheckinResult>(null)
  const [todayVisits, setTodayVisits] = useState<VisitRow[]>([])
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<ModalState | null>(null)

  const handleImageError = useCallback((url: string) => {
    setFailedImageUrls((prev) => new Set(prev).add(url))
  }, [])
  const [isProcessing, setIsProcessing] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)

  const loadShift = useCallback(async () => {
    try {
      const sh = await fetchCurrentShift().catch(() => null)
      setShift(sh ?? null)
    } catch {
      setShift(null)
    }
  }, [])

  const loadTodayVisits = useCallback(async () => {
    try {
      const d = new Date()
      const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
      const { data } = await fetchVisits({ from_date: today, to_date: today, limit: 10 })
      setTodayVisits(data)
    } catch {
      setTodayVisits([])
    }
  }, [])

  const loadOccupancy = useCallback(async () => {
    if (!qrAccess) return
    try {
      const occ = await fetchOccupancy().catch(() => null)
      setOccupancy(occ ?? null)
    } catch {
      setOccupancy(null)
    }
  }, [qrAccess])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        if (qrAccess) {
          const [occ, sh, _] = await Promise.all([
            fetchOccupancy().catch(() => null),
            fetchCurrentShift().catch(() => null),
            loadTodayVisits(),
          ])
          if (!cancelled) {
            setOccupancy(occ ?? null)
            setShift(sh ?? null)
          }
        } else {
          const [sh, _] = await Promise.all([
            fetchCurrentShift().catch(() => null),
            loadTodayVisits(),
          ])
          if (!cancelled) setShift(sh ?? null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [qrAccess, loadTodayVisits])

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
      void loadTodayVisits()
      void loadOccupancy()

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
          userName: payload?.user?.name ?? null,
          userPhotoUrl: payload?.user?.profile_picture_url ?? null,
          message: error.message,
        })
        return
      }

      if (
        payload?.code === 'NO_ACTIVE_SUBSCRIPTION' ||
        payload?.code === 'SUBSCRIPTION_FROZEN' ||
        error.message.includes('No active subscription') ||
        error.message.toLowerCase().includes('frozen') ||
        error.message.toLowerCase().includes('suscripción') ||
        error.message.toLowerCase().includes('membresía')
      ) {
        const isFrozen = payload?.code === 'SUBSCRIPTION_FROZEN'
        setModal({
          state: 'debtor',
          userName: payload?.user?.name ?? null,
          userPhotoUrl: payload?.user?.profile_picture_url ?? null,
          message: isFrozen
            ? 'Membresía congelada. Descongele para dar acceso.'
            : 'Membresía vencida o inactiva.',
          userId: payload?.user_id,
          debtorBadge: isFrozen ? 'Membresía congelada' : 'Membresía vencida',
          debtorBadgeVariant: isFrozen ? 'info' : 'danger',
        })
        return
      }

      setModal({
        state: 'antipassback',
        userName: payload?.user?.name ?? null,
        userPhotoUrl: payload?.user?.profile_picture_url ?? null,
        message: error.message,
      })
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, loadTodayVisits, loadOccupancy])

  const handleCourtesyRequest = useCallback(async (userId: string) => {
    try {
      await submitCourtesyCheckin(userId)
      sileo.warning({ title: 'Acceso de cortesía registrado' })
      void loadTodayVisits()
      void loadOccupancy()
    } catch (e) {
      sileo.error({
        title: 'Error',
        description: (e as Error).message,
      })
    }
  }, [loadTodayVisits, loadOccupancy])

  const modalOpen = modal !== null || openShiftModal || closeShiftModal || cameraOpen

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
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                title="El input mantiene el foco para que el escáner USB escriba sin tocar nada"
              >
                <ScanLine className="h-3.5 w-3.5" />
                Listo para escanear
              </span>
            </div>

            <p className="mt-4 text-xs text-zinc-500">
              El lector QR USB escribe el código completo seguido de{' '}
              <span className="font-mono text-zinc-700 dark:text-zinc-300">Enter</span>. Este
              panel captura y procesa cada lectura sin que el recepcionista tenga que tocar nada.
            </p>

            <div className="mt-4">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-white/10 bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5 px-2.5 py-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="h-3.5 w-3.5" />
                Usar cámara
              </button>
            </div>
          </div>

          {/* Check-ins de hoy */}
          <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-3">
              Check-ins de hoy
            </h2>
            {todayVisits.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-6 text-center">
                <ScanLine className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-2" />
                <p className="text-xs text-zinc-500">
                  Aún no hay check-ins hoy. El próximo escaneo mostrará aquí los datos del socio.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayVisits.map((visit, idx) => {
                  const isFirst = idx === 0
                  const rawPhotoUrl = visit.user_profile_picture_url ?? null
                  const photoUrl = rawPhotoUrl && !failedImageUrls.has(rawPhotoUrl) ? rawPhotoUrl : null
                  const name = visit.user_name ?? 'Desconocido'
                  const time = new Date(visit.check_in_time).toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const showStreak = isFirst && lastResult?.streak_updated && lastResult.user.name === name
                  if (isFirst) {
                    return (
                      <div key={visit.id} className="flex items-start gap-4">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={name}
                            referrerPolicy="no-referrer"
                            className="h-14 w-14 rounded-full object-cover border-2 border-zinc-200 dark:border-white/10 shrink-0"
                            onError={() => rawPhotoUrl && handleImageError(rawPhotoUrl)}
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-full border-2 border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center text-lg font-semibold text-zinc-400">
                            {name.charAt(0) ?? '?'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {name}
                          </p>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE.success}`}
                          >
                            Acceso concedido
                          </span>
                          <p className="text-xs text-zinc-500">{time}</p>
                          {showStreak && lastResult ? (
                            <p className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                              <span role="img" aria-hidden="true">🔥</span>
                              <span>Racha: {lastResult.newStreak} días</span>
                            </p>
                          ) : lastResult?.newStreak && lastResult.user.name === name ? (
                            <p className="text-xs text-zinc-500">Racha: {lastResult.newStreak} días</p>
                          ) : null}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div
                      key={visit.id}
                      className="flex items-center gap-3 py-1.5 border-t border-zinc-100 dark:border-zinc-800"
                    >
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={name}
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 rounded-full object-cover border border-zinc-200 dark:border-white/10 shrink-0"
                          onError={() => rawPhotoUrl && handleImageError(rawPhotoUrl)}
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center text-xs font-semibold text-zinc-400">
                          {name.charAt(0) ?? '?'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {name}
                        </p>
                        <p className="text-xs text-zinc-500">{time}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Columna derecha: Aforo (solo con Check-in QR) + Turno caja */}
        <aside className="space-y-4">
          {qrAccess && (
            <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                Aforo actual
              </h3>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {occupancy?.current_count ?? 0}
                <span className="text-sm font-normal text-zinc-500 ml-1">
                  / {occupancy?.capacity ? occupancy.capacity : '∞'}
                </span>
              </p>
            </div>
          )}

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

      <CameraScanner
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={handleSubmit}
        mode="qr"
        title="Escanear QR del socio"
      />
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
          debtorBadge={modal.debtorBadge}
          debtorBadgeVariant={modal.debtorBadgeVariant}
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
