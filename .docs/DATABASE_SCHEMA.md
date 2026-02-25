# Modelo de Datos (DATABASE_SCHEMA)

Este documento describe el schema completo que Prisma ORM despliega en PostgreSQL (Supabase auto-alojado).

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
enum Role            { SUPERADMIN  ADMIN  RECEPTIONIST  INSTRUCTOR  COACH  MEMBER }
enum SubscriptionStatus { ACTIVE  EXPIRED  CANCELED  FROZEN }
enum SubscriptionTier   { BASIC  PRO_QR  PREMIUM_BIO }
enum ShiftStatus     { OPEN  CLOSED }
enum ExpenseType     { SUPPLIER_PAYMENT  OPERATIONAL_EXPENSE  CASH_DROP }
enum AccessMethod    { MANUAL  QR  BIOMETRIC }
enum AccessType      { REGULAR  COURTESY }
enum TransactionType { RESTOCK  LOSS  SALE }
enum BookingStatus  { PENDING  ATTENDED  CANCELLED }
```

---

## Diccionario de Tablas (Nuevas y Actualizadas)

### `Gym` (Actualizada)
Motor de Feature Flags por gimnasio y estado del inquilino (billing/churn).

| Campo | Tipo | Notas |
|---|---|---|
| `status` | String | `ACTIVE` \| `SUSPENDED` \| `CANCELLED` (default ACTIVE) |
| `deleted_at` | DateTime? | Soft delete; purga (hard delete) tras 60 días si status CANCELLED |
| `logo_url` | String? | White-label logo del gym |
| `last_reactivated_at` | DateTime? | Streak freeze: cuando pasó de SUSPENDED a ACTIVE (perdón 48h en check-in) |
| `modules_config` | Json? | Configuración de módulos habilitados derivada de `subscription_tier` (enforced por trigger DB) |
| `n8n_config` | Json? | Configuración de mensajería por gym (`sender_phone_id`, templates, eventos habilitados, overrides) |

**Enforcement DB:**
- Trigger SQL activo: `backend/prisma/sql/enforce_modules_config_by_tier.sql`.
- En cada `INSERT/UPDATE` de `Gym`, recalcula `modules_config` según `subscription_tier`.
- Evita drift por ediciones manuales directas en la base.

---

### `User` (Actualizada)
Soporte para validación visual, gamificación por día y n8n (cumpleaños).

| Campo | Tipo | Notas |
|---|---|---|
| `profile_picture_url` | String? | URL de foto de perfil del socio |
| `last_checkin_date` | DateTime? @db.Date | Último día calendario con check-in (para racha 1 vez/día) |
| `birth_date` | DateTime? @db.Date | Fecha de nacimiento (n8n felicitaciones) |

### `Subscription` (Actualizada)
Añade restricciones horarias para planes específicos (ej. "Solo Mañanas").

| Campo | Tipo | Notas |
|---|---|---|
| `allowed_start_time` | String? | HH:mm (ej: "06:00") |
| `allowed_end_time` | String? | HH:mm (ej: "12:00") |

---

### `Class` (Nueva)
Gestión de clases grupales con cupo limitado.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `gym_id` | UUID FK | Multitenancy |
| `instructor_id` | UUID FK | Referencia a `User` con rol `INSTRUCTOR` |
| `name` | String | Nombre de la clase (ej: "Yoga", "Crossfit") |
| `capacity` | Int | Cupo máximo de personas |
| `day_of_week` | Int | 0-6 (0=Domingo) |
| `start_time` | String | HH:mm |
| `end_time` | String | HH:mm |

---

### `Booking` (Nueva)
Reservas de socios para clases.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `gym_id` | UUID FK | |
| `class_id` | UUID FK | |
| `user_id` | UUID FK | |
| `booking_date` | Date | Fecha específica de la reserva |
| `status` | BookingStatus | PENDING / ATTENDED / CANCELLED |

---

### `Routine` (Nueva)
Gestión de entrenamiento personalizado.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `gym_id` | UUID FK | |
| `user_id` | UUID FK | Socio dueño de la rutina |
| `name` | String | Ej: "Volumen - Mes 1" |
| `description` | String? | |

---

### `WorkoutExercise` (Nueva)
Ejercicios individuales dentro de una rutina.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `routine_id` | UUID FK | |
| `name` | String | Ej: "Press de Banca" |
| `sets` | Int | |
| `reps` | Int | |
| `weight` | Decimal? | |
| `notes` | String? | |

---

### `CashShift` (Turnos de caja)
Un turno por usuario; ventas y egresos se asocian al turno abierto del usuario que opera. Flujo: abrir → operar → cerrar (corte con saldo real). Detalle en **CORTES_CAJA_Y_STOCK.md**.

| Campo | Tipo | Notas |
|---|---|---|
| `gym_id` | UUID FK | Multitenancy |
| `user_id` | UUID FK | Recepcionista dueño del turno |
| `opening_balance` | Decimal | Fondo inicial al abrir |
| `status` | ShiftStatus | OPEN / CLOSED |
| `opened_at` | DateTime | Apertura |
| `closed_at` | DateTime? | Cierre (corte) |
| `expected_balance` | Decimal? | Saldo esperado (fondo + ventas - egresos) al cerrar |
| `actual_balance` | Decimal? | Saldo real registrado al cerrar |

### `Expense` (Egresos de caja)
Cada egreso se asocia al turno abierto del usuario que lo registra. Clasificación por tipo para control de fugas y reportes.

| Campo | Tipo | Notas |
|---|---|---|
| `gym_id` | UUID FK | Multitenancy |
| `cash_shift_id` | UUID FK | Turno en el que se registró |
| `type` | ExpenseType | SUPPLIER_PAYMENT / OPERATIONAL_EXPENSE / CASH_DROP |
| `amount` | Decimal | Monto |
| `description` | String? | Obligatorio en UI para SUPPLIER_PAYMENT y OPERATIONAL_EXPENSE; opcional para CASH_DROP |

### `Sale` (Actualizada)
Rastreo de comisiones y staff.

| Campo | Tipo | Notas |
|---|---|---|
| `cash_shift_id` | UUID FK | Turno en el que se realizó la venta |
| `seller_id` | UUID FK? | Referencia al `User` (Staff) que realizó la venta |

---

## Acciones Auditadas Adicionales

| Action | Disparado en |
|---|---|
| `CLASS_CREATED` | Alta de nueva clase grupal |
| `BOOKING_CANCELLED` | Cancelación de reserva |
| `ROUTINE_ASSIGNED` | Nueva rutina creada para un socio |
| `SHIFT_CLOSED` | Cierre de turno (incluye expected, actual, difference) |
| `SHIFT_FORCE_CLOSED` | Cierre forzado de turno por Admin (force-close) |
| `USER_SOFT_DELETED` | Dar de baja a usuario (Personal) |
