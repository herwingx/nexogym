import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface ModalCloseButtonProps {
  onClose: () => void
  /** 'default' para modales claros, 'dark' para fondos oscuros (ej. escáner cámara) */
  variant?: 'default' | 'dark'
  className?: string
}

/** Botón de cerrar unificado para modales. Icono X consistente, animación sutil. */
export function ModalCloseButton({
  onClose,
  variant = 'default',
  className,
}: ModalCloseButtonProps) {
  return (
    <button
      type="button"
      aria-label="Cerrar"
      onClick={onClose}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-150',
        'hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/30',
        variant === 'default' &&
          'border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800',
        variant === 'dark' &&
          'text-white/80 hover:bg-white/10 hover:text-white',
        className,
      )}
    >
      <X className="h-4 w-4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </button>
  )
}
