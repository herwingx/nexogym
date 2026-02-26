import { useRef, useEffect, useCallback, type KeyboardEvent } from 'react'

export interface HardwareScannerProps {
  value: string
  onChange: (value: string) => void
  /** Callback when user submits (Enter) with the trimmed string. */
  onSubmit: (value: string) => void
  /** When true, do not refocus the input on blur (e.g. modal open). */
  pauseFocus?: boolean
  /** Delay in ms before refocusing after blur. Default 100. */
  refocusDelayMs?: number
  /** When true, shows a visible input for typing/scanning. Default false (invisible for hardware-only). */
  visible?: boolean
  /** Placeholder when visible. */
  placeholder?: string
}

/**
 * Input invisible para pistola USB/lector QR. Mantiene foco perpetuo y
 * recupera foco tras blur en refocusDelayMs, salvo cuando pauseFocus es true.
 */
export function HardwareScanner({
  value,
  onChange,
  onSubmit,
  pauseFocus = false,
  refocusDelayMs = 100,
  visible = false,
  placeholder = 'Escanear o escribir código...',
}: HardwareScannerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleBlur = useCallback(() => {
    if (pauseFocus) return
    const t = setTimeout(() => {
      inputRef.current?.focus()
    }, refocusDelayMs)
    return () => clearTimeout(t)
  }, [pauseFocus, refocusDelayMs])

  useEffect(() => {
    if (!pauseFocus) inputRef.current?.focus()
  }, [pauseFocus])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const code = value.trim()
      if (code) onSubmit(code)
    }
  }

  const inputClasses = visible
    ? 'w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/50'
    : 'opacity-0 absolute -z-10 left-0 top-0 w-px h-px'

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClasses}
      placeholder={visible ? placeholder : undefined}
      autoComplete="off"
      autoFocus
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      aria-label="Lector de código de barras"
    />
  )
}
