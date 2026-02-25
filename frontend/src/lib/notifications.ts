import { sileo } from 'sileo'

/**
 * Notificaciones con Sileo. El tema (claros en dark, oscuros en light) y los
 * colores por estado (success, error, warning, info) se aplican desde el
 * Toaster en App.tsx vía theme={mode}, usando los valores originales de la librería.
 */
export const notifySuccess = (
  options: Parameters<typeof sileo.success>[0],
) => sileo.success(options)

export const notifyError = (options: Parameters<typeof sileo.error>[0]) =>
  sileo.error(options)

export const notifyPromise: typeof sileo.promise = (promise, opts) =>
  sileo.promise(promise, opts)

