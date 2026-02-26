import { useEffect, useRef, useId } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { ModalCloseButton } from '../ui/ModalCloseButton'
import { notifyError } from '../../lib/notifications'

export type CameraScannerMode = 'qr' | 'barcode'

export interface CameraScannerProps {
  isOpen: boolean
  onClose: () => void
  /** Callback cuando se escanea un código válido. */
  onScan: (code: string) => void
  /** 'qr' = solo QR (check-in). 'barcode' = códigos de barras (POS). */
  mode?: CameraScannerMode
  /** Si true, no cierra el modal tras escanear (para escanear varios). Default false. */
  continuousScan?: boolean
  /** Título del modal. */
  title?: string
}

const QR_FORMATS = [Html5QrcodeSupportedFormats.QR_CODE]
const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
]

/**
 * Modal con escáner de cámara para QR o códigos de barras.
 * Compatible con móvil y PC. Usa html5-qrcode.
 */
export function CameraScanner({
  isOpen,
  onClose,
  onScan,
  mode = 'qr',
  continuousScan = false,
  title,
}: CameraScannerProps) {
  const elementId = `camera-scanner-${useId().replace(/:/g, '')}`
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isRunningRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return

    const formats = mode === 'qr' ? QR_FORMATS : BARCODE_FORMATS
    const scanner = new Html5Qrcode(elementId, {
      formatsToSupport: formats,
      verbose: false,
    })
    scannerRef.current = scanner
    isRunningRef.current = false

    const config =
      mode === 'qr'
        ? { fps: 10, qrbox: { width: 250, height: 250 } }
        : {
            fps: 10,
            qrbox: (w: number, h: number) => ({ width: Math.min(w, 400), height: Math.min(h * 0.4, 120) }),
          }

    scanner
      .start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          if (!scannerRef.current) return
          onScan(decodedText.trim())
          if (!continuousScan) {
            scannerRef.current.stop().catch(() => {}).finally(() => {
              isRunningRef.current = false
              scannerRef.current = null
              onClose()
            })
          }
        },
        () => {
          // error callback: ignoramos errores de scan (frame sin código)
        },
      )
      .then(() => {
        isRunningRef.current = true
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        const isPermissionDenied =
          msg.includes('NotAllowedError') ||
          msg.includes('Permission denied') ||
          msg.includes('PermissionDeniedError')
        if (isPermissionDenied) {
          notifyError({
            title: 'Permiso de cámara denegado',
            description:
              'Permite el acceso a la cámara en la configuración del navegador o del sitio. Recarga la página e inténtalo de nuevo.',
          })
        } else {
          notifyError({
            title: 'No se pudo acceder a la cámara',
            description: msg || 'Verifica que tengas una cámara conectada y que el sitio tenga permiso.',
          })
        }
        scannerRef.current = null
        onClose()
      })

    return () => {
      if (!isRunningRef.current) {
        scannerRef.current = null
        return
      }
      scanner
        .stop()
        .catch(() => {})
        .finally(() => {
          isRunningRef.current = false
          scannerRef.current = null
        })
    }
  }, [isOpen, elementId, mode, continuousScan, onScan, onClose])

  if (!isOpen) return null

  const displayTitle = title ?? (mode === 'qr' ? 'Escanear QR del socio' : 'Escanear código de barras')

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black min-h-[100dvh]"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={displayTitle}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white">
        <h2 className="text-sm font-medium">{displayTitle}</h2>
        <ModalCloseButton
          variant="dark"
          onClose={() => {
            if (isRunningRef.current && scannerRef.current) {
              scannerRef.current.stop().catch(() => {}).finally(() => {
                isRunningRef.current = false
                scannerRef.current = null
                onClose()
              })
            } else {
              scannerRef.current = null
              onClose()
            }
          }}
        />
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-2">
        <div
          id={elementId}
          className="w-full max-w-md aspect-square rounded-xl overflow-hidden bg-black"
        />
      </div>
      <p className="px-4 py-2 text-center text-xs text-white/60">
        {mode === 'qr'
          ? 'Apunta la cámara al QR del socio. Se procesará automáticamente.'
          : 'Apunta la cámara al código de barras del producto.'}
      </p>
    </div>
  )
}
