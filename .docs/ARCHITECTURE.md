# Arquitectura del Sistema (ARCHITECTURE)

Actualizado tras la implementación del ERP Full (Sprints B1–B11).

---

## Stack Tecnológico Estricto

### 1. Frontend (SPA/PWA)
- **Framework:** React (Vite) + TypeScript
- **Estilos:** Tailwind CSS con variables CSS dinámicas (white-labeling por gym)
- **Gestión de Estado:** Zustand
- **Iconografía:** Lucide React
- **PWA:** `vite-plugin-pwa` — instalable en móvil
- **Ruteador:** React Router DOM v6+

### 2. Backend (API REST)
- **Entorno:** Node.js + Express + TypeScript
- **ORM:** Prisma v7 (con `prisma.config.ts` para datasource URL — sin `url` en `schema.prisma`)
- **Seguridad:** Helmet + CORS + rate limiting
- **Logger:** pino-http (HTTP) + AuditLog en DB (acciones de negocio)
- **Validación:** Zod en todos los endpoints de escritura

### 3. Base de Datos y Autenticación
- **Plataforma:** Supabase (PostgreSQL) **auto-alojado** en red local
- **Auth:** Supabase Auth — JWT validado en `auth.middleware.ts`
- **Conexión runtime:** `DATABASE_URL` vía pgBouncer (puerto 5432)
- **Conexión migraciones:** `DIRECT_URL` directa a Postgres (puerto 5433)

### 4. Automatización (n8n)
- **Orquestador:** n8n local (fire-and-forget)
- **Webhooks activos:**
  - `/webhook/nuevo-cliente` → WhatsApp de bienvenida con PIN y QR
  - `/webhook/recompensa` → WhatsApp cuando se desbloquea un premio
  - `/webhook/corte-caja` → WhatsApp/PDF del corte al dueño
- **Modelo recomendado:** flujo por tipo de evento (compartido) + personalización por gym vía `Gym.n8n_config`
- **Contexto de evento enviado por backend:** `gym_id`, `gym_name`, `event`, `access_method` (MANUAL/QR/BIOMETRIC)
- **Personalización por tenant:** `sender_phone_id`, templates y `webhook_overrides` por evento

### 5. IoT / Hardware
- Torniquetes ZKTeco se autentican con `x-api-key` (`Gym.api_key_hardware`)
- Endpoint dedicado sin JWT: `POST /biometric/checkin`

---

## Estructura de Archivos del Backend

```
backend/
├── prisma/
│   ├── schema.prisma          # Schema ERP completo (13 modelos, 8 enums)
│   └── .env                   # DATABASE_URL + DIRECT_URL (para CLI Prisma)
├── prisma.config.ts           # Prisma 7: datasource URL + trigger SQL post-push
├── src/
│   ├── db.ts                  # PrismaClient singleton
│   ├── server.ts              # Express app + rutas + shutdown limpio
│   ├── config/
│   │   └── env.ts             # Variables de entorno tipadas con Zod
│   ├── controllers/
│   │   ├── saas.controller.ts       # SuperAdmin: CRUD gyms + export + métricas globales
│   │   ├── user.controller.ts       # CRM: ciclo de vida del socio + GDPR
│   │   ├── checkin.controller.ts    # Accesos + cortesías + gamificación + anti-passback
│   │   ├── inventory.controller.ts  # Stock + restock + mermas + historial movimientos
│   │   ├── pos.controller.ts        # Ventas POS + egresos + listado turnos
│   │   ├── shift.controller.ts      # Apertura/cierre de turno + reconciliación
│   │   ├── analytics.controller.ts  # Ocupación + revenue + reporte financiero + comisiones
│   │   ├── booking.controller.ts    # Clases + reservas + asistencia (Módulo 10)
│   │   ├── routine.controller.ts    # Rutinas de entrenamiento + ejercicios (Módulo 10)
│   │   └── biometric.controller.ts  # IoT ZKTeco
│   ├── middlewares/
│   │   ├── auth.middleware.ts            # JWT Supabase → req.gymId, req.userRole
│   │   ├── admin.middleware.ts           # requireAdminOrSuperAdmin
│   │   ├── superadmin.middleware.ts      # requireSuperAdmin
│   │   ├── hardware.middleware.ts        # x-api-key → req.gymId
│   │   ├── module-access.middleware.ts   # requireModuleEnabled('pos'|'classes'|'biometrics'|...)
│   │   └── rate-limit.middleware.ts      # Límites por ruta (general, checkin, biométrico)
│   ├── routes/
│   │   ├── saas.routes.ts         # /api/v1/saas — 9 rutas (SUPERADMIN)
│   │   ├── user.routes.ts         # /api/v1/users — 13 rutas
│   │   ├── checkin.routes.ts      # /api/v1/checkin — 2 rutas
│   │   ├── inventory.routes.ts    # /api/v1/inventory — 7 rutas (flag: pos)
│   │   ├── pos.routes.ts          # /api/v1/pos — 8 rutas (flag: pos)
│   │   ├── analytics.routes.ts    # /api/v1/analytics — 5 rutas
│   │   ├── booking.routes.ts      # /api/v1/bookings — 8 rutas (flag: classes)
│   │   ├── routine.routes.ts      # /api/v1/routines — 8 rutas (flag: classes)
│   │   └── biometric.routes.ts    # /biometric — 1 ruta (flag: biometrics)
│   ├── schemas/
│   │   ├── booking.schema.ts      # Zod: createBooking
│   │   ├── checkin.schema.ts      # Zod: processCheckin
│   │   ├── pos.schema.ts          # Zod: createSale, registerExpense
│   │   ├── routine.schema.ts      # Zod: createRoutine, updateRoutine, addExercise
│   │   └── saas.schema.ts         # Zod: updateGym
│   ├── services/
│   │   └── n8n.service.ts         # Fire-and-forget webhooks (bienvenida, recompensa, corte)
│   ├── observability/
│   │   └── metrics.ts             # prom-client: volumen + latencia HTTP
│   ├── utils/
│   │   ├── audit.logger.ts        # logAuditEvent(gymId, userId, action, details)
│   │   ├── modules-config.ts      # resolveModulesConfig(modules_config, tier)
│   │   └── http.ts                # handleControllerError — respuestas homogéneas
│   ├── lib/
│   │   └── supabase.ts            # Supabase client para verificar JWT
│   └── types/
│       └── express.d.ts           # Augmentación: req.gymId, req.userRole, req.user
└── .env                           # Variables runtime del servidor Express
```

---

## Reglas Inquebrantables de Arquitectura

### 1. Multitenancy Absoluto
- **Toda** consulta Prisma lleva `where: { gym_id: req.gymId }`
- El `gym_id` se extrae del JWT en `auth.middleware.ts` y se inyecta en `req.gymId`
- Para hardware IoT, `hardware.middleware.ts` extrae `gym_id` del `api_key_hardware`
- **NO HAY EXCEPCIONES**

### 2. Soft Deletes
- **NUNCA** usar `prisma.model.delete()`
- Todo borrado actualiza `deleted_at: new Date()`
- Todas las queries de lectura incluyen `deleted_at: null`
- Modelos con soft delete: `User`, `Product`

### 3. Transacciones ACID
- **Todo** proceso que toque dinero o stock usa `prisma.$transaction()`
- Operaciones cubiertas: `createSale`, `restockProduct`, `adjustLoss`
- Garantiza que si falla un paso, ningún cambio parcial persiste en DB

### 4. Auditoría Anti-Fraude
- `utils/audit.logger.ts` → `logAuditEvent(gymId, userId, action, details)`
- Nunca lanza excepción (no bloquea el flujo principal)
- Acciones críticas auditadas: cortesías, mermas, actualizaciones de usuario, cierres de caja

### 4.1 Controles de acceso y validación visual (B13)
- `checkin.controller.ts` aplica Anti-Passback: bloquea reingreso antes de 4 horas
- `checkin.controller.ts` devuelve `user.name` y `user.profile_picture_url` para validación en recepción
- `user.controller.ts` permite actualizar `profile_picture_url` desde `updateUser`

### 4.2 Feature Flags por tenant
- `Gym.modules_config` guarda módulos activos por gimnasio (JSON: `pos`, `qr_access`, `gamification`, `classes`, `biometrics`)
- El trigger SQL `enforce_gym_modules_config_by_tier` en PostgreSQL sincroniza `modules_config` automáticamente al cambiar `subscription_tier`
- `module-access.middleware.ts` → `requireModuleEnabled(flag)` bloquea rutas con 403 si el módulo está desactivado
- Módulos gateados:
  - `pos` → rutas de inventario y POS
  - `classes` → rutas de bookings y rutinas
  - `biometrics` → endpoint IoT biométrico
  - `qr_access` → método QR en check-in (validado en controller)
- `saas.controller.ts → updateGymTier()` recalcula `modules_config` al cambiar tier
- `GET /api/v1/saas/metrics` expone `total_active_gyms` para panel global

### 4.3 Seguridad y resiliencia operativa (Fase 2)
- Rate limiting en `server.ts` con política general para `/api/v1` y límites específicos para `/api/v1/checkin` y `/biometric`
- Manejo de errores estandarizado vía `utils/http.ts` (`handleControllerError`) para respuestas homogéneas y logs estructurados
- Eliminación de `console.error` en controladores/middlewares de request path

### 4.4 Integración Auth Supabase (Fase 2)
- `User.auth_user_id` como vínculo explícito entre usuario de Supabase y usuario interno del ERP
- `auth.middleware.ts` resuelve identidad por `id` legado o `auth_user_id` y adjunta `req.authUserId`
- Soporte RBAC reforzado en rutas sensibles de CRM (`ADMIN` / `SUPERADMIN`)

### 4.5 Operación Production-Ready (Fase 3)
- Configuración centralizada y tipada en `config/env.ts` (puertos, CORS, body-limit, rate limits)
- Endpoint de readiness `GET /health/ready` con verificación real de DB (`SELECT 1`)
- Apagado limpio: cierre de servidor HTTP + desconexión Prisma + cierre de pool PostgreSQL
- Rate limiting configurable por entorno (API general, check-in, biométrico)

### 4.6 Observabilidad avanzada (Fase 4)
- Instrumentación HTTP con `prom-client` en `observability/metrics.ts`
- Endpoint `GET /metrics` con protección opcional por `METRICS_TOKEN`
- Métricas base incluidas: volumen de requests y latencia por ruta/método/estado

### 5. Variables de Entorno (Dos archivos .env)
| Archivo | Usado por | Propósito |
|---|---|---|
| `backend/.env` | Express en runtime | `DATABASE_URL` con dominio externo |
| `backend/prisma/.env` | Prisma CLI | `DIRECT_URL` con IP local para migraciones |

Ambos están en `.gitignore` vía el patrón `**/.env`.
