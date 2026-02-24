# Arquitectura del Sistema (ARCHITECTURE)

Actualizado tras la implementación del ERP Full (Sprints B1–B9).

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
- **ORM:** Prisma (con `@prisma/adapter-pg` para pool de conexiones)
- **Seguridad:** Helmet + CORS + Morgan
- **Logger:** Morgan (HTTP) + AuditLog en DB (acciones de negocio)

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
│   ├── schema.prisma          # Schema ERP completo (10 modelos)
│   └── .env                   # DATABASE_URL + DIRECT_URL (para CLI Prisma)
├── src/
│   ├── db.ts                  # PrismaClient con adapter PgBouncer
│   ├── server.ts              # Express app + rutas
│   ├── controllers/
│   │   ├── saas.controller.ts       # SuperAdmin: crear/gestionar gyms
│   │   ├── user.controller.ts       # CRM: ciclo de vida del socio
│   │   ├── checkin.controller.ts    # Accesos + cortesías + gamificación
│   │   ├── inventory.controller.ts  # Stock + restock + mermas
│   │   ├── pos.controller.ts        # Ventas POS + egresos
│   │   ├── shift.controller.ts      # Turnos de caja
│   │   ├── analytics.controller.ts  # Dashboards + reportes + auditoría
│   │   └── biometric.controller.ts  # IoT ZKTeco
│   ├── middlewares/
│   │   ├── auth.middleware.ts        # JWT Supabase → req.gymId, req.userRole
│   │   ├── hardware.middleware.ts    # x-api-key → req.gymId
│   │   └── superadmin.middleware.ts  # Guard de rol SUPERADMIN
│   ├── routes/
│   │   ├── saas.routes.ts
│   │   ├── user.routes.ts
│   │   ├── checkin.routes.ts
│   │   ├── inventory.routes.ts
│   │   ├── pos.routes.ts
│   │   ├── analytics.routes.ts
│   │   └── biometric.routes.ts
│   ├── services/
│   │   └── n8n.service.ts     # Fire-and-forget webhooks
│   ├── utils/
│   │   └── audit.logger.ts    # logAuditEvent(gymId, userId, action, details)
│   ├── lib/
│   │   └── supabase.ts        # Supabase client para verificar JWT
│   └── types/
│       └── express.d.ts       # Augmentación: req.gymId, req.userRole
└── .env                       # Variables runtime del servidor Express
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

### 4.2 Feature Flags por tenant (B13)
- `Gym.modules_config` guarda módulos activos por gimnasio
- `saas.controller.ts` asigna `modules_config` al crear/actualizar planes
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
