# Contratos de la API (API_SPEC)

## Sprints Adicionales — Gestión Profesional de Gimnasio

---

## Formato de respuestas de error

Las respuestas de error de la API siguen este contrato:

```json
{ "error": "Mensaje legible para el cliente" }
```

En **desarrollo** (`NODE_ENV !== 'production'`), las respuestas **500** pueden incluir un campo opcional `detail` con el mensaje técnico del error (excepción del servidor, mensaje de Prisma/DB, etc.) para facilitar la depuración. El frontend puede mostrar este `detail` en toasts o logs.

```json
{ "error": "Failed to retrieve user context.", "detail": "column \"theme_colors\" of relation \"Gym\" does not exist" }
```

En producción solo se envía `error`; nunca se expone `detail` al cliente.

---

## Sprint B10 — Reservas y Clases (Booking)

### `GET /api/v1/classes`
Lista clases disponibles según el día de la semana.
```json
// Query: ?day=1 (Lunes)
{ "data": [{ "id": "uuid", "name": "Yoga", "start_time": "08:00", "capacity": 15, "available_slots": 4 }] }
```

### `POST /api/v1/bookings`
Reserva un lugar en una clase. Valida cupo y membresía activa.
```json
{ "classId": "uuid", "date": "2026-02-23" }
```

### `DELETE /api/v1/bookings/:id`
Cancela una reserva.

---

## Sprint B11 — Rutinas y Seguimiento (Routines)

### `POST /api/v1/routines`
Asigna una rutina a un socio (Solo ADMIN/INSTRUCTOR).
```json
{
  "userId": "uuid",
  "name": "Fuerza G1",
  "exercises": [
    { "name": "Sentadilla", "sets": 4, "reps": 12, "weight": 60 }
  ]
}
```

### `GET /api/v1/routines/me`
El socio consulta sus rutinas asignadas.

---

## Sprint B12 — Comisiones y Control Horario

### `GET /api/v1/analytics/commissions`
Reporte de ventas por staff para pago de comisiones.

### `POST /api/v1/checkin` (Actualizado)
**RBAC:** Requiere rol Staff (Admin, Recepcionista o SuperAdmin). Socios (MEMBER), Coach e Instructor no pueden hacer check-in de otros socios.

**Nueva Validación:** Si la suscripción tiene `allowed_start_time` y `allowed_end_time`, el sistema deniega el acceso fuera de ese rango aunque la membresía esté "ACTIVA".
```json
// Response 403 (Fuera de horario)
{ "success": false, "reason": "Fuera de horario permitido para su plan (06:00 - 12:00)" }
```

**Anti-Passback (Nuevo):** Si el usuario ya registró entrada hace menos de 4 horas, se bloquea el acceso.
```json
// Response 403 (Anti-Passback)
{ "error": "Anti-Passback: Este código ya fue utilizado hace menos de 4 horas." }
```

**Entrada opcional (QR):**
```json
{ "userId": "uuid", "accessMethod": "QR" }
```

**Respuesta exitosa (Actualizada):** incluye datos visuales para pantalla de recepción/escáner.
```json
{
  "success": true,
  "newStreak": 3,
  "rewardUnlocked": false,
  "user": {
    "name": "Juan Pérez",
    "profile_picture_url": "https://cdn.example.com/users/u1.jpg"
  },
  "message": "¡De vuelta al ruedo!"
}
```

---

## Sprint B13 — SaaS Feature Flags y Métricas

### `POST /api/v1/saas/gyms` (Actualizado)
Crea gimnasio y asigna `modules_config` automáticamente según `subscription_tier` (sin override manual). Opcionalmente crea el primer administrador del gym (usuario en Supabase Auth + User en DB con rol ADMIN).

**Body (todos los campos excepto `name` son opcionales):**
- `name` (string, requerido): nombre del gimnasio.
- `subscription_tier` (opcional): `"BASIC"` | `"PRO_QR"` | `"PREMIUM_BIO"`.
- `theme_colors`, `n8n_config`, `logo_url`: opcionales (igual que antes).
- **Admin (opcional, los tres juntos):** `admin_email`, `admin_password` (mín. 6 caracteres), `admin_name`. Si se envían `admin_email` y `admin_password`, el servidor crea el usuario en Supabase Auth y el User en la DB con `role: ADMIN` y `gym_id` del gym recién creado. Requiere `SUPABASE_SERVICE_ROLE_KEY` en el backend; si no está configurado, responde `503`.

**Ejemplo con admin:**
```json
{
  "name": "Mi Gym",
  "subscription_tier": "PRO_QR",
  "admin_email": "admin@migym.com",
  "admin_password": "contraseñaSegura",
  "admin_name": "Carlos Admin"
}
```

**Respuesta 201:** `{ "message": "...", "gym": { ... }, "admin": { "email": "admin@migym.com" } }` (el campo `admin` solo aparece si se creó el administrador).

Config de mensajería por gym para n8n (opcional):
```json
{
  "n8n_config": {
    "sender_phone_id": "whatsapp-number-1",
    "template_welcome": "bienvenida_v1",
    "template_reward": "recompensa_v2",
    "enabled_events": ["welcome", "reward", "shift_summary"]
  }
}
```

### `GET /api/v1/saas/metrics` (Nuevo)
Devuelve el total de gimnasios activos registrados en la base de datos.
```json
{ "total_active_gyms": 42 }
```

### `GET /api/v1/saas/gyms/:id/modules` (Nuevo)
Devuelve los módulos resueltos para el gimnasio, listos para renderizar menús/features en frontend.
```json
{
  "gym_id": "uuid",
  "gym_name": "Gym Pro",
  "subscription_tier": "PRO_QR",
  "modules_config": {
    "pos": true,
    "qr_access": true,
    "gamification": true,
    "classes": true,
    "biometrics": false
  }
}
```

> Nota operativa: además del control en API, la DB aplica trigger para forzar `modules_config` por `subscription_tier` y evitar cambios manuales fuera del flujo oficial.

---

## Fase 2 — Hardening Operativo

### Rate Limiting (Nuevo)
- La API aplica límites por IP para mitigar abuso y picos no controlados.
- Endpoints con política reforzada: `POST /api/v1/checkin` y `POST /biometric/checkin`.

```json
// Response 429
{ "error": "Too many requests. Please try again later." }
```

### `GET /health/ready` (Nuevo)
Readiness probe para orquestación/monitoring. Verifica conectividad con DB.
```json
{ "status": "READY", "service": "GymSaaS Backend API" }
```

```json
// Response 503
{ "status": "NOT_READY", "service": "GymSaaS Backend API" }
```

### `GET /metrics` (Fase 4)
Expone métricas Prometheus (`text/plain`) para observabilidad operacional.

- Si `METRICS_TOKEN` está configurado, requiere:
  - `Authorization: Bearer <token>` **o**
  - header `x-metrics-token: <token>`.

```json
// Response 401
{ "error": "Unauthorized: invalid metrics token" }
```

---

## Portal del socio (Members)

Solo rol `MEMBER`. Requiere `Authorization: Bearer <token>` y contexto de gym en JWT.

### `GET /api/v1/members/me`
Perfil del socio para el portal: membresía, racha, visitas, próximo premio.
```json
{
  "id": "uuid",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "profile_picture_url": null,
  "membership_status": "ACTIVE",
  "membership_type": null,
  "expiry_date": "2026-12-31",
  "current_streak": 3,
  "best_streak": 5,
  "total_visits": 42,
  "next_reward": { "label": "Batido gratis", "visits_required": 7, "visits_progress": 3 },
  "streak_rewards": [
    { "days": 7, "label": "Batido gratis" },
    { "days": 30, "label": "Mes gratis" }
  ]
}
```
- `membership_status`: `ACTIVE` | `EXPIRED` | `SUSPENDED`
- `next_reward`: `null` si no hay siguiente hito. El `label` viene de la configuración del gym (`rewards_config.streak_rewards` o legacy).
- `streak_rewards`: lista de premios por racha configurados por el gym (`[{ days, label }, ...]`). El portal del socio muestra "Estás participando por racha para los siguientes premios" con esta lista.

### `GET /api/v1/members/me/history?page=1&pageSize=10`
Historial de visitas (check-ins) del socio, paginado.
```json
{
  "data": [
    {
      "id": "uuid",
      "checked_in_at": "2026-02-20T10:00:00.000Z",
      "access_method": "QR",
      "streak_at_checkin": null
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 10
}
```
- `page` por defecto 1; `pageSize` entre 1 y 100.

---

## Configuración del gym (Admin)

Solo **Admin o SuperAdmin** del gym. Requiere **módulo gamification** activo (planes no BASIC). Si el plan no tiene gamificación, la API responde **403** con mensaje `Feature disabled for current subscription: gamification`.

### `GET /api/v1/gym/rewards-config`
Devuelve la configuración de premios por racha del gym.
```json
{
  "streak_rewards": [
    { "days": 7, "label": "Batido gratis" },
    { "days": 30, "label": "Mes gratis" }
  ]
}
```
- Si el gym no tiene `streak_rewards` configurados, se devuelve `streak_rewards: []`.

### `PATCH /api/v1/gym/rewards-config`
Actualiza los premios por racha. Cada hito es un número de días consecutivos de visita y el texto que verá el socio al alcanzarlo (y que se usa en la notificación por WhatsApp si n8n está configurado).
```json
{
  "streak_rewards": [
    { "days": 7, "label": "Batido gratis" },
    { "days": 30, "label": "Mes gratis" }
  ]
}
```
- **Validación:** `days` entero ≥ 1; `label` entre 1 y 120 caracteres; máximo 20 hitos; no se permiten días duplicados.
- El backend guarda en `Gym.rewards_config.streak_rewards`. El check-in y el perfil del socio (`GET /members/me`) usan esta configuración para desbloquear premios y mostrar el próximo hito.

---

## Frontend Handoff — Ciclo de Vida de Socio

### `GET /api/v1/users/me/context`
Devuelve el contexto de sesión para bootstrap frontend (usuario + gym + módulos resueltos). Incluye white-label: `theme_colors` y `logo_url` para personalización por gym.

**Códigos:** `200` OK, `401` Context missing, `403` Gym suspendido (excepto SUPERADMIN), `404` User/gym no encontrado, `500` Error interno (en desarrollo la respuesta puede incluir `detail` con el mensaje técnico).

```json
{
  "user": { "id": "uuid", "role": "ADMIN", "name": "Admin Gym", "profile_picture_url": null },
  "gym": {
    "id": "uuid",
    "name": "Gym Pro",
    "subscription_tier": "PRO_QR",
    "modules_config": {
      "pos": true,
      "qr_access": true,
      "gamification": true,
      "classes": true,
      "biometrics": false
    },
    "theme_colors": { "primary": "#2563eb", "secondary": "#3b82f6" },
    "logo_url": "https://cdn.example.com/gym-logo.png"
  }
}
```

`theme_colors` y `logo_url` son opcionales; el frontend usa fallbacks si faltan.

### `GET /api/v1/users/search?q=<texto>`
Búsqueda rápida para recepción por nombre o teléfono (Staff). Mín. 2 caracteres.
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Juan Pérez",
      "phone": "+573001112233",
      "profile_picture_url": "https://cdn.example.com/u1.jpg",
      "role": "MEMBER"
    }
  ]
}
```

### `GET /api/v1/users?page=1&limit=50&role_not=MEMBER`
Lista usuarios del gym (Staff). Query **role_not=MEMBER** devuelve solo usuarios que no son socios (admin, recepcionista, coach, etc.). Incluye `deleted_at` para mostrar inactivos. Requiere `can_use_reception`. Usado por la vista **Personal** (`/admin/staff`).

### `GET /api/v1/users/instructors`
Lista usuarios COACH e INSTRUCTOR activos del gym (sin paginación). Requiere `can_use_routines`. Usado por **Clases** (`/admin/classes`) para el dropdown de instructores. Permite a coaches acceder a Clases sin necesitar `can_use_reception`.

### `DELETE /api/v1/users/:id`
**Solo Admin/SuperAdmin.** Soft delete del usuario (`deleted_at = now()`). Usado en **Personal** para "Dar de baja". No borra registros; el usuario queda inactivo y sin acciones en la UI.

### `PATCH /api/v1/users/:id/cancel-subscription`
Cancela inmediatamente una suscripción `ACTIVE` o `FROZEN`.
```json
{ "reason": "Solicitud del cliente" }
```

```json
{ "message": "Subscription cancelled successfully.", "subscription": { "id": "uuid", "status": "CANCELED" } }
```

### `GET /api/v1/users/:id/data-export`
Exporta los datos del socio para cumplimiento y portabilidad (JSON).
```json
{
  "generated_at": "2026-02-23T22:00:00.000Z",
  "user": { "id": "uuid", "name": "Juan", "phone": "+573001112233" },
  "subscriptions": [],
  "visits": [],
  "bookings": []
}
```

### `POST /api/v1/users/:id/anonymize`
Anonimiza PII del socio y cancela suscripciones activas (irreversible).

### `POST /api/v1/users/:id/send-qr`
Reenvía el QR de acceso del socio por WhatsApp (mismo código estable). Staff.
```json
{ "message": "Si el gym tiene WhatsApp configurado, el socio recibirá su código de acceso en unos segundos." }
```

### `POST /api/v1/users/:id/regenerate-qr`
Regenera el QR del socio (invalida el anterior). Solo Admin/SuperAdmin.
```json
// Body opcional
{ "sendToWhatsApp": true }
// Response
{ "message": "QR regenerado. El socio recibirá el nuevo código por WhatsApp en unos segundos." }
```

---

## POS y turnos de caja (Shifts)

Rutas bajo `/api/v1/pos` (requieren `requireAuth` + módulo `pos`). Turno por usuario: ventas y egresos se asocian al turno abierto del usuario que opera. Detalle en **.docs/CORTES_CAJA_Y_STOCK.md**.

### `GET /api/v1/pos/shifts/current`
Devuelve el turno abierto del usuario actual con totales (ventas, egresos, saldo esperado). `404` si no hay turno abierto.

### `GET /api/v1/pos/shifts/open`
**Solo Admin/SuperAdmin.** Lista todos los turnos abiertos del gym (recepcionistas que aún no han hecho corte). Útil para supervisión.
```json
{ "data": [{ "id": "uuid", "opened_at": "ISO8601", "opening_balance": 500, "user": { "id": "uuid", "name": "Ana" } }] }
```

### `POST /api/v1/pos/shifts/open`
Abre turno del usuario actual. Body: `{ "opening_balance": number }`. `400` si ya tiene un turno abierto.

### `POST /api/v1/pos/shifts/close`
Cierra el turno del usuario actual. Body: `{ "actual_balance": number }`. `404` si no hay turno abierto. **Cierre ciego:** si el rol es RECEPTIONIST, la respuesta es solo `200` con `{ "message": "Turno cerrado exitosamente." }` (no se devuelve reconciliación ni diferencia). Para ADMIN/SUPERADMIN se devuelve `shift` y `reconciliation` (expected, actual, difference, status).

### `PATCH /api/v1/pos/shifts/:id/force-close`
**Solo Admin/SuperAdmin.** Cierra forzosamente un turno (ej. empleado salió sin corte). Body opcional: `{ "actual_balance": number }` (default 0). Se registra en auditoría como `SHIFT_FORCE_CLOSED`.

### `POST /api/v1/pos/expenses`
Registra un egreso en el turno abierto del usuario. Body: `{ "amount": number, "type": "SUPPLIER_PAYMENT" | "OPERATIONAL_EXPENSE" | "CASH_DROP", "description"?: string }`. Para `SUPPLIER_PAYMENT` y `OPERATIONAL_EXPENSE` la descripción es obligatoria (mín. 5 caracteres); para `CASH_DROP` es opcional. `400` si no hay turno abierto o validación falla.

---

## Qué falta y por qué (revisión posterior)

Este doc es el **contrato** de la API (sprints y endpoints). Lo que “falta” aquí no son pasos en el repo, sino claridad sobre estado de implementación:

| Qué puede faltar | Dónde revisar | Por qué |
|------------------|----------------|--------|
| **Endpoints de un sprint no implementados aún** | Código en `backend/src/routes/` y controladores | Los sprints son planificación; la implementación se hace por fases. Si un endpoint de este doc no existe en el backend, falta desarrollarlo según el contrato. |
| **Diferencias entre este spec y el comportamiento real** | Tests y Swagger (`/api-docs`) | Si la API se desvía del spec (campos, códigos de error), hay que actualizar el spec o el código para que coincidan. |
| **Documentación OpenAPI (JSDoc @swagger)** por endpoint | Comentarios en las rutas; ver TESTING_STRATEGY.md | Cada endpoint debe tener su bloque JSDoc para que Swagger esté al día; es responsabilidad al añadir o cambiar rutas. |
