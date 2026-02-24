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
Crea gimnasio con `modules_config` por defecto si no se envía explícitamente:
```json
{ "modules_config": { "pos": true, "qr_access": false, "gamification": false, "classes": false } }
```

### `GET /api/v1/saas/metrics` (Nuevo)
Devuelve el total de gimnasios activos registrados en la base de datos.
```json
{ "total_active_gyms": 42 }
```

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
