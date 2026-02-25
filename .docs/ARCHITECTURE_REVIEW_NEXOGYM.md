# Revisión Arquitectónica NexoGym — Backend–Frontend y Escalabilidad B2B

Diagnóstico punto por punto de la integración actual y ajustes recomendados para blindar la base antes de nuevas funcionalidades.

> **Implementación (refactor posterior):** Las mejoras de esta revisión se implementaron según la especificación maestra. Ver [REFACTOR_BILLING_RBAC_CHECKIN.md](./REFACTOR_BILLING_RBAC_CHECKIN.md) para el detalle de cambios (tenant status, tenant guard, check-in 2h/streak, COACH, n8n birthdays, purga cron, etc.).

---

## 1. Ciclo de Vida del Inquilino (Gimnasios) y SuperAdmin

### 1.1 Gestión de Planes (Upgrades y Downgrades)

**Estado: ✅ Cubierto**

- **Backend:** `PATCH /saas/gyms/:id/tier` (`saas.controller.ts` → `updateGymTier`) actualiza `subscription_tier` y recalcula `modules_config` con `DEFAULT_MODULES_CONFIG_BY_TIER[subscription_tier]`.
- **Trigger DB:** `apply-trigger.ts` / `enforce_gym_modules_config_by_tier` asegura que al cambiar el tier, `modules_config` se sincroniza automáticamente (BASIC, PRO_QR, PREMIUM_BIO).
- **Frontend:** SuperAdmin puede cambiar tier desde el dashboard (`handleTierChange` → `updateGymTier`). No hay flujo explícito de “downgrade con confirmación” ni ventana de gracia; el cambio es inmediato.

**Recomendación opcional:** Para downgrades, considerar un flujo que advierta pérdida de módulos (QR, gamificación, clases, biometría) y, si se desea, una ventana de gracia (ej. “efectivo en 7 días”) con un campo `pending_tier` o similar. No es obligatorio para “100% cubierto” operativo.

---

### 1.2 Bajas de Gimnasios (Churn)

**Estado: ⚠️ Parcial — Solo Hard Delete**

- **Implementado:** `DELETE /saas/gyms/:id` con header `x-confirm-delete: CONFIRM_DELETE`. **Hard delete:** `prisma.gym.delete({ where: { id } })`; por `onDelete: Cascade` en el schema, se borran en cascada Users, Subscriptions, Visits, Products, Sales, etc.
- **No implementado:** Soft delete del tenant (desactivación preservando datos por X tiempo). El modelo `Gym` no tiene `deleted_at` ni `status`.

**Qué pasa con las suscripciones activas de miembros:** Al dar de baja el tenant (hard delete), todas las filas relacionadas desaparecen por cascade. No hay “cierre ordenado” de suscripciones (ej. marcarlas CANCELED y notificar); es borrado total.

**Ajustes recomendados:**

1. **Opción A — Soft delete del tenant (recomendado para B2B):**
   - En `schema.prisma`, añadir a `Gym`:
     - `deleted_at DateTime?`
     - Opcional: `status String? @default("ACTIVE")` (ACTIVE | SUSPENDED | CHURNED).
   - Crear `PATCH /saas/gyms/:id/deactivate` (o `suspend`) que:
     - Ponga `deleted_at: now()` y/o `status: 'SUSPENDED'`.
     - Opcional: en la misma transacción, actualizar todas las `Subscription` del gym a `CANCELED` y `expires_at: now`.
   - En todos los flujos que “entran” al gym (auth middleware, check-in, POS, etc.), filtrar por `gym.deleted_at == null` (y opcionalmente `status == 'ACTIVE'`). Listados SuperAdmin deben poder ver gimnasios desactivados con filtro.
   - Mantener `DELETE /saas/gyms/:id` para purga definitiva tras retención (ej. 90 días), o renombrar a “purge” y documentar que es irreversible.

2. **Opción B — Mantener solo Hard Delete:** Dejar el comportamiento actual y documentar que “dar de baja” = borrado permanente; asegurar export antes (`GET /saas/gyms/:id/export`) y flujo de confirmación fuerte en la UI.

---

## 2. Personalización B2B (White-Labeling)

**Estado: ✅ Corregido (había una brecha)**

- **Persistencia:** `Gym.theme_colors` (Json) guarda por ejemplo `{ "primary": "#ff0000" }`. Se actualiza con `PATCH /saas/gyms/:id` (SuperAdmin). El seed ya usa `theme_colors` con `primary` (y en algunos `secondary`).
- **Frontend:** 
  - `useAuthStore` tiene `tenantTheme: { primaryHex }`.
  - `deriveThemeFromHex` (colord) genera `--theme-primary` y `--theme-primary-foreground` (WCAG).
  - `App.tsx` aplica esas variables al `document.documentElement` en `useApplyTenantTheme`.
  - Tailwind usa `primary: 'hsl(var(--theme-primary))'` y `primary-foreground`.

**Brecha detectada y corregida:** El endpoint `GET /users/me/context` (**getMyContext**) no devolvía `theme_colors`. El frontend (Login y AuthRestore) usa `context.gym.theme_colors?.primary` para `tenantTheme.primaryHex`; al no estar en la respuesta, siempre caía al fallback `#2563eb`.

**Cambios realizados:**
- En `user.controller.ts`, `getMyContext` ahora incluye en el `select` del gym `theme_colors` y lo devuelve en la respuesta como `gym.theme_colors`.
- En `apiClient.ts`, `UserContextResponse.gym` incluye `theme_colors?: { primary?: string; ... }`.
- AuthRestore ya no necesita cast; usa `context.gym.theme_colors?.primary`.

**Pendiente documental (no bloqueante):**
- **Logo:** No hay campo `logo_url` (o similar) en `Gym` ni en el contexto. Si se quiere logo por tenant, añadir en schema algo como `logo_url String?` y exponerlo en el mismo contexto.
- **Tema Dark/Light:** La preferencia actual es local en el frontend (`mode` en `App.tsx`), no persistida por tenant en backend. Si se desea “por gimnasio”, añadir por ejemplo `theme_preference: "light" | "dark" | "system"` en `Gym` (o en `theme_colors`) y leerlo en el contexto para aplicar `document.documentElement.classList.add('dark')` según esa preferencia.

---

## 3. Jerarquía de Roles (RBAC) y Rol COACH

### 3.1 Creación de socios (MEMBERS)

**Estado: ✅ Confirmado**

- **Backend:** `POST /users` (crear usuario) está protegido con `requireStaff`. En `admin.middleware.ts`, `requireStaff` permite `ADMIN`, `RECEPTIONIST` y `SUPERADMIN`. Por tanto, tanto ADMINS como RECEPTIONISTS pueden crear MEMBERS.
- SUPERADMIN no opera dentro de un gym concreto (entra a `/saas`); la creación de socios se hace desde el contexto de un gym por ADMIN o RECEPTIONIST.

### 3.2 Rol COACH (nuevo)

**Estado: 🔶 Factible; requiere cambios en schema y rutas**

- **Situación actual:** Existe el rol `INSTRUCTOR` en el enum `Role`. Las rutas de **clases** y **asistencia** usan `requireAdminOrSuperAdmin` (crear/editar/borrar clases, marcar asistencia). Las rutas de **rutinas** también usan `requireAdminOrSuperAdmin`. Por tanto, INSTRUCTOR no tiene acceso a estas APIs con la configuración actual.
- **Objetivo COACH:** Sin acceso a POS ni métricas financieras; solo directorio de miembros, crear/editar rutinas, registrar asistencia a clases.

**Ajustes recomendados:**

1. **Schema:** Añadir al enum `Role` el valor `COACH` (o reutilizar `INSTRUCTOR` con semántica “solo clases + rutinas + miembros”, según naming que prefieran).
2. **Middleware:** Crear por ejemplo `requireCoachOrAdmin` que permita `COACH` y `ADMIN` (y opcionalmente `SUPERADMIN`), y usarlo en:
   - Rutinas: `GET /routines`, `GET /routines/member/:userId`, `POST /routines`, `PATCH /routines/:id`, `DELETE /routines/:id`, ejercicios.
   - Bookings: `PATCH /bookings/:id/attend` (marcar asistencia).
   - Clases: Decidir si COACH puede solo leer clases y marcar asistencia, o también crear/editar (habitualmente solo Admin crea la oferta de clases).
3. **POS y finanzas:** No incluir a COACH en `requireStaff` para rutas de POS, caja, inventario, analytics, auditoría. Es decir, COACH no debe tener permisos de recepcionista en dinero.
4. **Frontend:** Nuevo rol en `useAuthStore` y rutas/layout para “Coach” (directorio miembros, rutinas, asistencia a clases), sin menú POS ni reportes.

Resumen: **Sí es factible** agregar COACH con la separación indicada; el cambio es principalmente RBAC (middleware + rutas) y opcionalmente un nuevo valor en el enum si no quieren reutilizar INSTRUCTOR.

---

## 4. Lógica Core del Gimnasio (Check-in y Gamificación)

### 4.1 Código QR del socio

**Estado: ✅ Correcto**

- **Dónde se genera:** En `user.controller.ts`, en `createUser`: `qr_token = crypto.randomBytes(16).toString('hex')` (32 caracteres hex). Se guarda en `User.qr_token` (único).
- **Cuándo:** Al dar de alta al socio (registro). Es un **token estático** hasta que se regenera.
- **Formato:** El payload enviado a n8n y usado en check-in es `GYM_QR_<qr_token>`. En check-in se acepta `code` (string); si empieza por `GYM_QR_`, se extrae el token y se resuelve el usuario por `qr_token` y `gym_id`.
- **Regeneración:** `POST /users/:id/regenerate-qr` (solo Admin/SuperAdmin) genera nuevo `qr_token` e invalida el anterior; opcionalmente reenvía por WhatsApp.

### 4.2 Validación de check-in (anti-passback)

**Estado: ✅ Implementado**

- En `checkin.controller.ts` (y en `biometric.controller.ts`), tras validar suscripción activa se comprueba `user.last_visit_at`. Si han pasado **menos de 4 horas** desde la última visita, se responde **403** con mensaje tipo “Anti-Passback: Este código ya fue utilizado hace menos de 4 horas.” y **no** se crea nueva visita ni se actualiza racha.
- Por tanto, un segundo escaneo a los 5 minutos es rechazado y no suma dos veces a la racha del día. La racha se actualiza solo cuando se acepta el check-in (en la transacción que actualiza `current_streak` y `last_visit_at` y crea la `Visit`).

---

## 5. Rendimiento, Carga y Persistencia (Multitenant)

**Estado: ✅ Aceptable; mejoras opcionales**

- **Multitenancy:** Todas las tablas operativas tienen `gym_id` y las consultas filtran por `req.gymId`. Índices `@@index([gym_id])` (y en muchos casos compuestos) están definidos en el schema, lo que evita full table scans por tenant.
- **Conexión:** Se usa `@prisma/adapter-pg` con un `Pool` de `pg`; adecuado para concurrencia. El ejemplo de `.env` usa PGBouncer (`pgbouncer=true&connection_limit=1`), apropiado para serverless o muchas conexiones.
- **Transacciones:** Operaciones críticas (venta POS, check-in con racha, renovar/congelar suscripción, anonimización) usan `prisma.$transaction`, reduciendo race conditions.
- **Bloqueos:** No se usan `SELECT ... FOR UPDATE` explícitos. En picos (ej. 18:00), la contención sería por filas (mismo gym, mismos productos/socios); con índices correctos y transacciones cortas es manejable.

**Recomendaciones opcionales:**

- Mantener transacciones cortas y evitar lógica pesada dentro de la transacción.
- Para listados muy grandes (ej. visitas del día por gym), considerar paginación y/o índices compuestos `(gym_id, check_in_time)` en `Visit`.
- Si en el futuro hubiera muchos escritores simultáneos en la misma fila (ej. contador global), valorar estrategias de desnormalización o colas, pero con el modelo actual por gym no es lo prioritario.

---

## 6. Automatizaciones Externas (n8n — Roadmap)

### 6.1 Fecha de nacimiento

**Estado: ❌ No implementado**

- En el schema de Prisma, el modelo `User` **no** tiene campo de fecha de nacimiento (`date_of_birth`, `birthday`, etc.). Solo hay `name`, `phone`, `profile_picture_url`, `pin_hash`, `role`, campos de gamificación, `deleted_at`, `qr_token`, timestamps.

**Ajuste recomendado:**

- Añadir a `User` en `schema.prisma` por ejemplo:
  - `birth_date DateTime? @db.Date`
- Usar tipo `Date` en PostgreSQL (o `@db.Date` en Prisma) para guardar solo fecha (sin hora). Así n8n puede leer “cumpleaños de hoy” sin problema de zona horaria si se compara por día.
- Actualizar `createUser` / `updateUser` (y schemas Zod) para aceptar opcionalmente `birth_date` (string ISO date o Date).

### 6.2 Endpoint / webhook para n8n (cumpleaños)

**Estado: 🔶 Parcial**

- **Existente:** `Gym.n8n_config` (Json) y servicios como `n8n.service` para enviar mensajes (bienvenida, reenvío QR, premios). La integración “hacia n8n” (backend llama a n8n) está pensada.
- **Para “n8n lee la BD”:** No hay un endpoint específico tipo “miembros con cumpleaños hoy” pensado para que n8n llame. Opciones:
  1. **Webhook/API desde n8n:** Crear un endpoint autenticado (por gym o por API key de n8n) por ejemplo `GET /api/v1/integrations/birthdays?date=YYYY-MM-DD` (o sin query, “hoy”) que devuelva lista de usuarios con `birth_date` ese día (y gym_id, nombre, teléfono para el mensaje). n8n haría un cron diario y llamaría a este endpoint por cada gym (o un solo endpoint que devuelva por gym_id).
  2. **Alternativa:** Que el backend tenga un job cron que cada día consulte usuarios con `birth_date = today` y llame a n8n por cada uno (flujo “backend empuja” en lugar de “n8n tira”). Ambas son válidas; la 1 es más flexible para n8n.

Resumen: Añadir `birth_date` al modelo y, en roadmap, definir un endpoint o job para exponer “cumpleaños del día” a n8n.

---

## Resumen de Acciones

| Área | Estado | Acción |
|------|--------|--------|
| Upgrades/Downgrades | ✅ | Ninguna obligatoria; opcional flujo de confirmación en downgrade. |
| Bajas (Churn) | ⚠️ | Implementar soft delete de Gym (`deleted_at`/status) y flujo de desactivación, o documentar que solo hay hard delete. |
| White-label (color/tema) | ✅ | Corregido: contexto devuelve `theme_colors`; opcional logo_url y theme_preference. |
| RBAC / COACH | 🔶 | Añadir COACH (o reutilizar INSTRUCTOR) y middleware/rutas para rutinas + asistencia, sin POS/finanzas. |
| QR y anti-passback | ✅ | Confirmado estático y anti-passback 4h. |
| Rendimiento multitenant | ✅ | Índices y transacciones correctos; opcional paginación/índices compuestos. |
| n8n / cumpleaños | ❌/🔶 | Añadir `birth_date` en User; definir endpoint o cron para n8n. |

Este documento puede usarse como checklist de arquitectura y referencia para los próximos sprints.
