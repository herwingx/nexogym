# Modelo de Datos (DATABASE_SCHEMA)

Este documento describe el schema completo que Prisma ORM despliega en PostgreSQL (Supabase auto-alojado). Actualizado tras la implementación del ERP Full (Sprints B1–B9).

---

## Reglas Globales del Schema

| Regla | Descripción |
|---|---|
| **Multitenancy** | Toda tabla operativa tiene `gym_id`. Cada query lleva `where: { gym_id }` |
| **Soft Delete** | NUNCA `prisma.model.delete()`. Borrado lógico con `deleted_at: new Date()` |
| **Índices** | `@@index([gym_id])` obligatorio en todas las tablas para rendimiento multitenant |
| **ACID** | Todo proceso que toque dinero o stock usa `prisma.$transaction()` |

---

## Enums

```prisma
enum Role            { SUPERADMIN  ADMIN  RECEPTIONIST  MEMBER }
enum SubscriptionStatus { ACTIVE  EXPIRED  CANCELED  FROZEN }
enum SubscriptionTier   { BASIC  PRO_QR  PREMIUM_BIO }
enum ShiftStatus     { OPEN  CLOSED }
enum AccessMethod    { MANUAL  QR  BIOMETRIC }
enum AccessType      { REGULAR  COURTESY }
enum TransactionType { RESTOCK  LOSS  SALE }
```

---

## Diccionario de Tablas

### `Gym` — Tenants Principales
Contiene la información de los clientes B2B. Todo gira en torno a esta tabla.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `name` | String | Nombre del gimnasio |
| `theme_colors` | Json (JSONB) | `{ "primary": "#ff007f", "accent": "#00f0ff" }` |
| `rewards_config` | Json (JSONB) | `{ "5": "Agua gratis", "20": "Camisa" }` — clave = streak |
| `subscription_tier` | SubscriptionTier | Plan del SaaS (BASIC / PRO_QR / PREMIUM_BIO) |
| `api_key_hardware` | String (unique) | API Key para torniquetes ZKTeco (Sprint B9) |

---

### `User` — Usuarios del Sistema
Todos los roles: dueños, recepcionistas y socios del gimnasio.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK = mismo ID de Supabase Auth |
| `gym_id` | UUID FK | Multitenancy |
| `name` | String? | |
| `phone` | String? | Único por gimnasio (`@@unique([gym_id, phone])`) |
| `pin_hash` | String? | SHA-256 del PIN. También sirve como ID biométrico |
| `role` | Role | SUPERADMIN / ADMIN / RECEPTIONIST / MEMBER |
| `current_streak` | Int | Racha de asistencia (gamificación) |
| `last_visit_at` | DateTime? | Para calcular si la racha continúa o se rompe |
| `deleted_at` | DateTime? | **Soft delete** — nunca borrar físicamente |

`@@index([gym_id])`

---

### `Subscription` — Membresías

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `gym_id` | UUID FK | Multitenancy |
| `user_id` | UUID FK | |
| `status` | SubscriptionStatus | ACTIVE / EXPIRED / CANCELED / **FROZEN** |
| `expires_at` | DateTime | Fecha de vencimiento |
| `frozen_days_left` | Int? | Días guardados al congelar la membresía |

`@@index([gym_id])` `@@index([user_id])`

---

### `Visit` — Registro de Accesos
Historial inmutable. Nunca se modifica, solo se inserta.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `gym_id` | UUID FK | Multitenancy |
| `user_id` | UUID FK | |
| `check_in_time` | DateTime | `@default(now())` |
| `access_method` | AccessMethod | MANUAL / QR / BIOMETRIC |
| `access_type` | AccessType | **REGULAR** / **COURTESY** — cortesías quedan marcadas |

`@@index([gym_id])` `@@index([user_id])`

---

### `Product` — Inventario POS

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `gym_id` | UUID FK | Multitenancy |
| `barcode` | String? | Único por gimnasio (`@@unique([gym_id, barcode])`) |
| `name` | String | |
| `price` | Decimal(10,2) | |
| `stock` | Int | Se modifica vía transacciones, nunca directamente |
| `deleted_at` | DateTime? | **Soft delete** |

`@@index([gym_id])`

---

### `InventoryTransaction` — Auditoría de Stock
Registro inmutable de cada movimiento de inventario. Previene el "robo hormiga".

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `gym_id` | UUID FK | Multitenancy |
| `product_id` | UUID FK | |
| `type` | TransactionType | RESTOCK / LOSS / SALE |
| `quantity` | Int | |
| `reason` | String? | **Obligatorio para LOSS** (justificación anti-fraude) |
| `created_at` | DateTime | `@default(now())` |

`@@index([gym_id])` `@@index([product_id])`

---

### `Sale` — Ventas del POS

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `gym_id` | UUID FK | Multitenancy |
| `cash_shift_id` | UUID FK? | Vinculada al turno abierto al momento de la venta |
| `total` | Decimal(10,2) | Suma de todos los SaleItems |
| `created_at` | DateTime | |

`@@index([gym_id])` `@@index([cash_shift_id])`

---

### `SaleItem` — Líneas de Venta

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `gym_id` | UUID FK | Multitenancy (incluido en tabla pivote) |
| `sale_id` | UUID FK | |
| `product_id` | UUID FK | |
| `quantity` | Int | |
| `price` | Decimal(10,2) | Precio **histórico** al momento de la venta |

`@@index([gym_id])` `@@index([sale_id])`

---

### `CashShift` — Turnos de Caja

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `gym_id` | UUID FK | Multitenancy |
| `user_id` | UUID FK | Recepcionista que abrió el turno |
| `opened_at` | DateTime | |
| `closed_at` | DateTime? | |
| `opening_balance` | Decimal(10,2) | Fondo inicial declarado |
| `expected_balance` | Decimal(10,2)? | Calculado: `Fondo + Ventas - Egresos` |
| `actual_balance` | Decimal(10,2)? | Monto físico declarado al cierre |
| `status` | ShiftStatus | OPEN / CLOSED |

`@@index([gym_id])` `@@index([user_id])`

---

### `Expense` — Egresos de Caja
Registra el dinero que **sale** de la caja durante un turno.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `gym_id` | UUID FK | Multitenancy |
| `cash_shift_id` | UUID FK | Turno al que pertenece |
| `amount` | Decimal(10,2) | |
| `description` | String | Ej: "Pago de garrafones", "Compra de papel" |
| `created_at` | DateTime | |

`@@index([gym_id])` `@@index([cash_shift_id])`

---

### `AuditLog` — Bitácora Anti-Fraude
Registro inmutable de acciones sensibles. El dueño puede consultar quién hizo qué.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `gym_id` | UUID FK | Multitenancy |
| `user_id` | UUID FK | Quién ejecutó la acción |
| `action` | String | Ej: `COURTESY_ACCESS_GRANTED`, `INVENTORY_LOSS_REPORTED`, `SHIFT_CLOSED` |
| `details` | Json? (JSONB) | Payload flexible con contexto del evento |
| `created_at` | DateTime | |

`@@index([gym_id])` `@@index([user_id])`

---

## Acciones Auditadas (AuditLog.action)

| Action | Disparado en |
|---|---|
| `SUBSCRIPTION_RENEWED` | `PATCH /users/:id/renew` |
| `SUBSCRIPTION_FROZEN` | `PATCH /users/:id/freeze` |
| `SUBSCRIPTION_UNFROZEN` | `PATCH /users/:id/unfreeze` |
| `USER_UPDATED` | `PATCH /users/:id` |
| `USER_SOFT_DELETED` | `DELETE /users/:id` |
| `COURTESY_ACCESS_GRANTED` | `POST /checkin/courtesy` |
| `INVENTORY_LOSS_REPORTED` | `POST /inventory/loss` |
| `SHIFT_CLOSED` | `POST /pos/shifts/close` |

---

## Fórmula del Corte de Caja

```
Expected Balance = Opening Balance + Total POS Sales - Total Expenses
Difference       = Actual Balance (físico) - Expected Balance
```

- `BALANCED` → diferencia = 0
- `SURPLUS` → diferencia > 0 (sobra dinero)
- `SHORTAGE` → diferencia < 0 (falta dinero, posible fraude)
