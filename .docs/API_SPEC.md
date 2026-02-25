# Contratos de la API (API_SPEC)

## Sprints Adicionales — Gestión Profesional de Gimnasio

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
Crea gimnasio y asigna `modules_config` automáticamente según `subscription_tier` (sin override manual):
```json
{ "subscription_tier": "BASIC" }
```

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
  "next_reward": { "label": "Racha 5 visitas", "visits_required": 5, "visits_progress": 3 }
}
```
- `membership_status`: `ACTIVE` | `EXPIRED` | `SUSPENDED`
- `next_reward`: `null` si no hay siguiente hito en `rewards_config.streak_bonus`

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

## Frontend Handoff — Ciclo de Vida de Socio

### `GET /api/v1/users/me/context`
Devuelve el contexto de sesión para bootstrap frontend (usuario + gym + módulos resueltos).
```json
{
  "user": { "id": "uuid", "role": "ADMIN", "name": "Admin Gym" },
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
    }
  }
}
```

### `GET /api/v1/users/search?q=<texto>`
Búsqueda rápida para recepción por nombre o teléfono.
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

## Qué falta y por qué (revisión posterior)

Este doc es el **contrato** de la API (sprints y endpoints). Lo que “falta” aquí no son pasos en el repo, sino claridad sobre estado de implementación:

| Qué puede faltar | Dónde revisar | Por qué |
|------------------|----------------|--------|
| **Endpoints de un sprint no implementados aún** | Código en `backend/src/routes/` y controladores | Los sprints son planificación; la implementación se hace por fases. Si un endpoint de este doc no existe en el backend, falta desarrollarlo según el contrato. |
| **Diferencias entre este spec y el comportamiento real** | Tests y Swagger (`/api-docs`) | Si la API se desvía del spec (campos, códigos de error), hay que actualizar el spec o el código para que coincidan. |
| **Documentación OpenAPI (JSDoc @swagger)** por endpoint | Comentarios en las rutas; ver TESTING_STRATEGY.md | Cada endpoint debe tener su bloque JSDoc para que Swagger esté al día; es responsabilidad al añadir o cambiar rutas. |
