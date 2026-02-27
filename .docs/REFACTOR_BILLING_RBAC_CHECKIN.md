# Refactor: Billing, Tenant Guard, Check-in, COACH, n8n (Implementado)

Resumen de los cambios implementados según la auditoría arquitectónica y la especificación maestra.

---

## 1. Máquina de Estados del Inquilino (Billing & Churn)

### Schema (`Gym`)

- **`status`** `String @default("ACTIVE")` — Valores: `ACTIVE`, `SUSPENDED`, `CANCELLED`.
- **`deleted_at`** `DateTime?` — Soft delete; purga tras retención (60 días).
- **`last_reactivated_at`** `DateTime?` — Para “streak freeze” al reactivar gym (perdón 48h).

### Webhooks

- **`POST /api/v1/webhooks/billing`** — Sin JWT. Body: `{ gym_id, event? }` (`event`: `subscription_expired` | `payment_failed`). Si el gym está `ACTIVE`, lo pasa a `SUSPENDED`. Opcional: header `x-billing-secret` si `BILLING_WEBHOOK_SECRET` está definido.
- **`POST /api/v1/webhooks/streak-reset`** — Sin JWT. Ejecuta el job de reset diario de rachas (socios con `last_checkin_date < ayer`). Header obligatorio `x-cron-secret` con valor de `CRON_WEBHOOK_SECRET`. Ejecutar diario a las 00:05 UTC. Ver **RACHAS_CRON.md**.
- Controlador: `backend/src/controllers/webhooks.controller.ts`.
- Rutas: `backend/src/routes/webhooks.routes.ts` → montado en `/api/v1/webhooks`.

### Purga (Cron)

- **Servicio:** `backend/src/services/cron.service.ts` → `purgeCancelledGyms()`.
- Busca gyms con `status: 'CANCELLED'` y `deleted_at` anterior a 60 días; ejecuta `prisma.gym.delete()` en cascada.
- Para ejecución diaria: invocar `purgeCancelledGyms()` desde un cron (node-cron, systemd timer, etc.).

### Control Manual (SuperAdmin)

- **`PATCH /api/v1/saas/gyms/:id/status`** — Body: `{ status: "ACTIVE" | "SUSPENDED" | "CANCELLED" }`.
- Al pasar a `CANCELLED`: se setea `deleted_at = now()`.
- Al pasar de `SUSPENDED` a `ACTIVE`: se setea `last_reactivated_at = now()` (para streak freeze).

---

## 2. Defensa de Sesiones (Tenant Guard en 2 Capas)

### Capa 1 — Establecimiento de sesión (contexto)

- **`GET /users/me/context`** — Si el gym del usuario tiene `status !== 'ACTIVE'` o `deleted_at != null`, responde **403** con mensaje: `"El acceso a este gimnasio está suspendido."` (excepto rol `SUPERADMIN`).

### Capa 2 — Middleware global

- **`requireAuth`** (`auth.middleware.ts`) — Tras resolver el usuario por JWT, carga el gym y comprueba `status === 'ACTIVE'` y `deleted_at == null`. Si no, responde **403** con el mismo mensaje. Rol `SUPERADMIN` exento.

---

## 3. Check-in vs. Gamificación (Lógica Separada)

### Regla de acceso (Visit) — Anti-passback 2h

- Si la última visita (`user.last_visit_at`) fue hace **menos de 2 horas**, se rechaza el check-in (403) y no se crea `Visit`. Permite varias visitas en un mismo día si han pasado ≥ 2h entre ellas.

### Regla de racha (Streak)

- **`User.last_checkin_date`** `DateTime? @db.Date` — Último día calendario con check-in.
- Solo si la **fecha del día actual** es **estrictamente mayor** que `last_checkin_date`, se incrementa la racha y se actualiza `last_checkin_date` a hoy. Mismo día → no se incrementa racha.
- La respuesta del check-in incluye **`streak_updated: true | false`** para que el frontend maneje la animación.

### Streak freeze (reactivación del gym)

- Si la diferencia de días entre hoy y `last_checkin_date` es **> 1** (lo que normalmente reiniciaría la racha a 1), se aplica una excepción: si **`gym.last_reactivated_at`** está en las **últimas 48 horas**, no se rompe la racha; se incrementa `current_streak` y se actualiza `last_checkin_date` a hoy.

---

## 4. White-Labeling (Marca Blanca)

- **`Gym.logo_url`** `String?` — Añadido al schema. Actualizable vía `PATCH /saas/gyms/:id` (y opcional en `POST /saas/gyms`).
- **`GET /users/me/context`** — Incluye en el objeto `gym`: `theme_colors` y **`logo_url`** para inyección dinámica en el frontend.

---

## 5. Rol COACH y Aislamiento de Rutas

- **Enum `Role`** — Añadido valor **`COACH`** en `schema.prisma`.
- **Middleware `requireCoachOrAdmin`** — Permite `ADMIN`, `SUPERADMIN` y `COACH`.
- Aplicado a:
  - Rutinas: list, get member routines, create, update, delete, add/remove exercises.
  - Bookings: **`PATCH /bookings/:id/attend`** (marcar asistencia).
- POS, inventario, analytics, auditoría y configuración siguen bajo **`requireAdminOrSuperAdmin`** (sin COACH).

---

## 6. Rendimiento y Paginación

- **Visit:** índice compuesto **`@@index([gym_id, check_in_time])`** para consultas por gym y rango de tiempo (horas pico).
- **Historial de visitas:** **`GET /api/v1/checkin/visits`** (Staff) con `?page` y `?limit` (paginación limit/offset). Usa el índice anterior.
- **Directorio de miembros:** **`GET /api/v1/users`** ya tenía paginación (`page`, `limit`); se mantiene.

---

## 7. Integración n8n (Cumpleaños)

- **`User.birth_date`** `DateTime? @db.Date` — Añadido al schema. Aceptado en **createUser** y **updateUser** (body opcional `birth_date` en formato fecha).
- **`GET /api/v1/integrations/birthdays?date=YYYY-MM-DD`** — Protegido (Admin o SuperAdmin). Devuelve usuarios con rol `MEMBER` cuyo **día y mes** de `birth_date` coinciden con la fecha. Respuesta: `{ date, data: [{ id, name, phone, gym_id }] }`. Si el usuario es Admin (tiene `gymId`), se filtra por ese gym.

---

## 8. Resumen de Archivos Modificados / Nuevos

| Archivo | Cambio |
|--------|--------|
| `backend/prisma/schema.prisma` | Gym: status, deleted_at, logo_url, last_reactivated_at; User: last_checkin_date, birth_date; Role: COACH; Visit: índice compuesto |
| `backend/src/middlewares/auth.middleware.ts` | Tenant guard: comprobar gym status en cada petición |
| `backend/src/middlewares/admin.middleware.ts` | Nuevo `requireCoachOrAdmin` |
| `backend/src/controllers/user.controller.ts` | getMyContext: tenant guard + logo_url; createUser/updateUser: birth_date |
| `backend/src/controllers/checkin.controller.ts` | Anti-passback 2h; last_checkin_date; streak_updated; streak freeze; listVisits |
| `backend/src/controllers/saas.controller.ts` | createGym/updateGym: logo_url; updateGymStatus; listGyms/getGlobalMetrics: status/deleted_at |
| `backend/src/controllers/webhooks.controller.ts` | **Nuevo** — billingWebhook |
| `backend/src/controllers/integrations.controller.ts` | **Nuevo** — getBirthdays |
| `backend/src/services/cron.service.ts` | **Nuevo** — purgeCancelledGyms |
| `backend/src/routes/webhooks.routes.ts` | **Nuevo** |
| `backend/src/routes/integrations.routes.ts` | **Nuevo** |
| `backend/src/routes/saas.routes.ts` | PATCH gyms/:id/status |
| `backend/src/routes/checkin.routes.ts` | GET /visits (requireStaff); listVisits |
| `backend/src/routes/routine.routes.ts` | requireCoachOrAdmin en rutinas |
| `backend/src/routes/booking.routes.ts` | requireCoachOrAdmin en PATCH :id/attend |
| `backend/src/server.ts` | Montaje webhooks e integrations |
| `backend/src/schemas/saas.schema.ts` | updateGymStatusSchema; logo_url en create/update |
| `backend/src/config/env.ts` | BILLING_WEBHOOK_SECRET opcional |

---

## Migración de Base de Datos

Tras actualizar el schema, ejecutar:

```bash
cd backend && npx prisma db push
# o, con migraciones: npx prisma migrate dev --name tenant_status_coach_birthdate
```

Para bases existentes, las nuevas columnas tienen defaults donde aplica (`status`, etc.). Si usas migraciones, Prisma generará los `ALTER TABLE` necesarios.
