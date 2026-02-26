import type { ReactNode, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ModalCloseButton } from './ModalCloseButton'
import { cn } from '../../lib/utils'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children?: ReactNode
  className?: string
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps) => {
  if (!isOpen) return null

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      onClose()
    }
  }

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/20 dark:bg-black/60 backdrop-blur-md min-h-[100dvh]"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'w-full max-w-lg mx-4 sm:mx-6 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-4 sm:p-6 shadow-xl transform transition-transform duration-150 ease-out max-h-[90vh] overflow-y-auto',
          'scale-100',
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {title && (
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {description}
              </p>
            )}
          </div>
          <ModalCloseButton onClose={onClose} variant="default" />
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

