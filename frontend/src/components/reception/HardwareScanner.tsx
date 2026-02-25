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

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="opacity-0 absolute -z-10 left-0 top-0 w-px h-px"
      autoFocus
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      aria-label="Lector QR"
    />
  )
}
