/**
 * Productos plantilla que se crean al dar de alta un gym.
 * El admin solo asigna precios en Inventario; no tiene que crear productos ni
 * escribir códigos de barras (el barcode es interno: la membresía no tiene
 * código físico, el sistema lo usa para identificar "Renovar mensualidad").
 *
 * - MEMBERSHIP*: usados en "Renovar" para elegir plan (semanal, mensual, anual, etc.).
 * - VISIT_1: venta en POS para visita de 1 día (no extiende suscripción por defecto).
 * Stock alto = no se agotan; precio 0 = aún no configurado.
 */
export const DEFAULT_GYM_PRODUCTS = [
  { barcode: 'MEMBERSHIP', name: 'Membresía 30 días', price: 0, stock: 99_999 },
  { barcode: 'MEMBERSHIP_WEEKLY', name: 'Membresía semanal', price: 0, stock: 99_999 },
  { barcode: 'MEMBERSHIP_BIWEEKLY', name: 'Membresía quincenal', price: 0, stock: 99_999 },
  { barcode: 'MEMBERSHIP_BIMESTRAL', name: 'Membresía bimestral', price: 0, stock: 99_999 },
  { barcode: 'MEMBERSHIP_SEMESTRAL', name: 'Membresía semestral', price: 0, stock: 99_999 },
  { barcode: 'MEMBERSHIP_ANNUAL', name: 'Membresía anual', price: 0, stock: 99_999 },
  { barcode: 'VISIT_1', name: 'Visita 1 día', price: 0, stock: 99_999 },
] as const;

/** Barcode por defecto para renovación (30 días) cuando no se elige plan. */
export const MEMBERSHIP_BARCODE = 'MEMBERSHIP';

/**
 * Días a sumar a la suscripción según el barcode del producto usado al renovar.
 * Solo productos de membresía (no VISIT_1). Usado por PATCH /users/:id/renew.
 */
export const PLAN_BARCODE_DAYS: Record<string, number> = {
  MEMBERSHIP_WEEKLY: 7,
  MEMBERSHIP_BIWEEKLY: 14,
  MEMBERSHIP: 30,
  MEMBERSHIP_BIMESTRAL: 60,
  MEMBERSHIP_SEMESTRAL: 180,
  MEMBERSHIP_ANNUAL: 365,
} as const;

/** Etiquetas para comprobante por correo y listados. */
export const PLAN_BARCODE_LABELS: Record<string, string> = {
  MEMBERSHIP_WEEKLY: 'Semanal',
  MEMBERSHIP_BIWEEKLY: 'Quincenal',
  MEMBERSHIP: 'Mensual',
  MEMBERSHIP_BIMESTRAL: 'Bimestral',
  MEMBERSHIP_SEMESTRAL: 'Semestral',
  MEMBERSHIP_ANNUAL: 'Anual',
};
