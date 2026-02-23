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

### 5. Variables de Entorno (Dos archivos .env)
| Archivo | Usado por | Propósito |
|---|---|---|
| `backend/.env` | Express en runtime | `DATABASE_URL` con dominio externo |
| `backend/prisma/.env` | Prisma CLI | `DIRECT_URL` con IP local para migraciones |

Ambos están en `.gitignore` vía el patrón `**/.env`.
