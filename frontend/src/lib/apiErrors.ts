/**
 * Errores y helpers para respuestas de la API.
 * Permite mostrar mensajes consistentes al usuario: "no está en tu plan" (403) y "recurso no encontrado" (404).
 */

const PLAN_RESTRICTION_PREFIX = 'Feature disabled for current subscription:'

export class PlanRestrictionError extends Error {
  /** Módulo que no está en el plan (ej. 'pos', 'gamification'). */
  readonly moduleKey?: string

  constructor(message: string, moduleKey?: string) {
    super(message)
    this.name = 'PlanRestrictionError'
    this.moduleKey = moduleKey
  }
}

export class ResourceNotFoundError extends Error {
  constructor(message: string = 'Recurso no encontrado') {
    super(message)
    this.name = 'ResourceNotFoundError'
  }
}

export function isPlanRestrictionError(e: unknown): e is PlanRestrictionError {
  return e instanceof PlanRestrictionError || (e instanceof Error && e.message.includes(PLAN_RESTRICTION_PREFIX))
}

export function isNotFoundError(e: unknown): e is ResourceNotFoundError | Error {
  if (e instanceof ResourceNotFoundError) return true
  if (e instanceof Error && e.message.toLowerCase().includes('not found')) return true
  return false
}

/**
 * Construye el Error adecuado a partir de la respuesta y el body.
 * - 403 con mensaje "Feature disabled for current subscription: X" → PlanRestrictionError
 * - 404 → ResourceNotFoundError con el mensaje del backend (o genérico)
 * - Resto → Error con mensaje del backend
 */
export function getErrorFromResponse(response: Response, data: Record<string, unknown>): Error {
  const message = (data?.error as string) ?? `Error (${response.status})`
  if (response.status === 403 && typeof message === 'string' && message.includes(PLAN_RESTRICTION_PREFIX)) {
    const match = message.match(new RegExp(`${PLAN_RESTRICTION_PREFIX}\\s*(\\w+)`))
    const moduleKey = match?.[1]
    return new PlanRestrictionError(message, moduleKey)
  }
  if (response.status === 404) {
    return new ResourceNotFoundError(typeof message === 'string' ? message : 'Recurso no encontrado')
  }
  return new Error(message)
}
