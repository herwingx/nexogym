import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

export type CheckInModalState =
  | 'granted'
  | 'streak'
  | 'antipassback'
  | 'debtor'

export interface CheckInModalProps {
  isOpen: boolean
  onClose: () => void
  state: CheckInModalState
  /** Para granted, streak, debtor: nombre y foto. Para antipassback puede ser genérico. */
  userName?: string | null
  userPhotoUrl?: string | null
  message?: string
  newStreak?: number
  /** Solo para debtor: userId para llamar cortesía. */
  userId?: string
  onCourtesyRequest?: (userId: string, reason?: string) => void
  /** Si true, no auto-cerrar (debtor). */
  noAutoClose?: boolean
}

const AUTO_CLOSE_MS = 3000

export function CheckInModal({
  isOpen,
  onClose,
  state,
  userName,
  userPhotoUrl,
  message,
  newStreak = 0,
  userId,
  onCourtesyRequest,
  noAutoClose = false,
}: CheckInModalProps) {
  useEffect(() => {
    if (!isOpen || noAutoClose) return
    const t = setTimeout(onClose, AUTO_CLOSE_MS)
    return () => clearTimeout(t)
  }, [isOpen, noAutoClose, onClose])

  if (!isOpen) return null

  const isError = state === 'antipassback'
  const isDebtor = state === 'debtor'

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/60 dark:bg-zinc-900/20 min-h-[100dvh]"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-modal-title"
    >
      <div
        className={cn(
          'w-full max-w-md rounded-xl border bg-white dark:bg-zinc-950 p-6 shadow-xl transform transition-transform duration-150 ease-out',
          isError && 'border-rose-500/30 dark:border-rose-500/30',
          !isError && 'border-zinc-200 dark:border-white/10',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            type="button"
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center mt-2">
          {/* Foto grande */}
          {userPhotoUrl ? (
            <img
              src={userPhotoUrl}
              alt={userName ?? 'Socio'}
              className="h-24 w-24 rounded-full object-cover border-2 border-zinc-200 dark:border-white/10"
            />
          ) : (
            <div className="h-24 w-24 rounded-full border-2 border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl text-zinc-400">
              {userName?.charAt(0) ?? '?'}
            </div>
          )}

          <h2 id="checkin-modal-title" className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {userName ?? 'Socio'}
          </h2>

          {message && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {message}
            </p>
          )}

          {/* Badges por estado */}
          {state === 'granted' && (
            <span className="mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              Acceso concedido
            </span>
          )}

          {state === 'streak' && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                Acceso concedido
              </span>
              <span className="inline-flex items-center gap-1 animate-pulse" title="Racha aumentada">
                <span role="img" aria-label="fuego">🔥</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {newStreak} días
                </span>
              </span>
            </div>
          )}

          {state === 'antipassback' && (
            <span className="mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">
              Acceso denegado
            </span>
          )}

          {state === 'debtor' && (
            <div className="mt-4 w-full space-y-3">
              <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">
                Membresía vencida
              </span>
              {userId && onCourtesyRequest && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    onCourtesyRequest(userId)
                    onClose()
                  }}
                >
                  Forzar acceso (cortesía)
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
  return createPortal(overlay, document.body)
}
