import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import { Camera, Keyboard } from 'lucide-react'
import { submitCheckin, type CheckinSuccessResponse } from '../lib/apiClient'
import { notifyError, notifyPromise } from '../lib/notifications'
import { Modal } from '../components/ui/Modal'

type CheckinResult = CheckinSuccessResponse | null

export const ReceptionCheckInPage = () => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [buffer, setBuffer] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<CheckinResult>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleBlur = () => {
    // Recuperar foco automáticamente para no perder lecturas del escáner
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const code = buffer.trim()
      if (!code || isProcessing) return
      void processCode(code)
    }
  }

  const processCode = async (code: string) => {
    setIsProcessing(true)
    setBuffer('')

    try {
      await notifyPromise(
        (async () => {
          const response = await submitCheckin(code, 'QR')
          setResult(response)
        })(),
        {
          loading: { title: 'Validando acceso...' },
          success: () => ({
            title: 'Acceso permitido',
            description: 'Check-in registrado correctamente.',
          }),
          error: (error) => ({
            title: 'Acceso denegado',
            description:
              (error as Error)?.message ??
              'Revisa el estado de la membresía o el horario del plan.',
          }),
        },
      )
    } finally {
      setIsProcessing(false)
      // Asegurar foco tras cada lectura
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-background text-foreground flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-3xl grid gap-4 md:grid-cols-[2fr,1.2fr]">
        <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-50">
                Check-in rápido
              </h2>
              <p className="text-xs text-zinc-500">
                Escáner USB como teclado. Solo apunta y dispara.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-1 text-[11px] text-zinc-400">
              <Keyboard className="h-3.5 w-3.5" />
              <span>Foco infinito</span>
            </div>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={buffer}
            onChange={(event) => setBuffer(event.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 opacity-0 -z-10"
            autoFocus
          />

          <div className="mt-6 space-y-3 text-xs text-zinc-400">
            <p>
              El lector QR USB escribe el código completo seguido de{' '}
              <span className="font-mono text-zinc-200">Enter</span>. Este
              panel captura y procesa cada lectura sin que el recepcionista
              tenga que tocar nada.
            </p>
            <p className="text-zinc-500">
              Si el backend devuelve un 403 por anti-passback o restricción
              horaria, se mostrará un toast con la razón exacta.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300"
              onClick={() =>
                notifyError({
                  title: 'Cámara no implementada aún',
                  description:
                    'En un sprint posterior integraremos html5-qrcode como opción secundaria.',
                })
              }
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Usar cámara</span>
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-50">
            Último check-in
          </h2>
          {result ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {result.user.profile_picture_url ? (
                  <img
                    src={result.user.profile_picture_url}
                    alt={result.user.name}
                    className="h-12 w-12 rounded-full object-cover border border-zinc-700/80"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-900/80" />
                )}
                <div>
                  <p className="text-sm font-medium text-zinc-50">
                    {result.user.name}
                  </p>
                  <p className="text-xs text-zinc-400">{result.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <span className="inline-flex items-center rounded-full border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-900/80 px-2 py-0.5">
                  Racha: <span className="ml-1 font-semibold">{result.newStreak}</span>{' '}
                  días
                </span>
                {result.rewardUnlocked && (
                  <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                    Premio desbloqueado
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              Aún no hay check-ins en esta sesión. El próximo escaneo mostrará
              aquí los datos del socio.
            </p>
          )}
        </section>
      </div>

      <Modal
        isOpen={Boolean(result)}
        onClose={() => setResult(null)}
        title={result?.user.name}
        description={result?.message}
      >
        {result && (
          <div className="flex items-center gap-4">
            {result.user.profile_picture_url ? (
              <img
                src={result.user.profile_picture_url}
                alt={result.user.name}
                className="h-16 w-16 rounded-full object-cover border border-zinc-700/80"
              />
            ) : (
              <div className="h-16 w-16 rounded-full border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-900/80" />
            )}
            <div className="space-y-1 text-sm text-zinc-300">
              <p>
                Racha actual:{' '}
                <span className="font-semibold">{result.newStreak} días</span>
              </p>
              {result.rewardUnlocked && (
                <p className="text-amber-300">
                  ¡Este socio acaba de desbloquear un premio!
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

