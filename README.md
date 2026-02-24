# GymSaaS ERP - Profesional Backend

ERP Multitenant de alto rendimiento para la gestión de gimnasios.

## Comandos Rápidos

- `npm install` - Instala dependencias.
- `npm run dev` - Levanta el servidor de desarrollo (tsx).
- `npm test` - Corre la suite de pruebas (Vitest).
- `npm run test:coverage` - Reporte de cobertura de código.
- `npx prisma migrate dev` - Aplica cambios en la base de datos.
- `npm run db:enforce-modules` - Aplica trigger DB que fuerza módulos por plan.

## Documentación
- **API (Swagger):** `http://localhost:3000/api-docs`
- **Health:** `http://localhost:3000/health`
- **Readiness:** `http://localhost:3000/health/ready`
- **Metrics (Prometheus):** `http://localhost:3000/metrics`
- **Estrategia de Pruebas:** [TESTING_STRATEGY.md](./.docs/TESTING_STRATEGY.md)
- **Playbook Frontend:** [FRONTEND_INTEGRATION.md](./.docs/FRONTEND_INTEGRATION.md)
- **Schema DB:** [DATABASE_SCHEMA.md](./.docs/DATABASE_SCHEMA.md)
- **Branch Protection:** [BRANCH_PROTECTION.md](./.docs/BRANCH_PROTECTION.md)
- **Go-Live Backend:** [GO_LIVE_CHECKLIST.md](./.docs/GO_LIVE_CHECKLIST.md)

## Requisitos
- Node.js 18+
- PostgreSQL (Supabase)
- n8n (opcional para webhooks de WhatsApp)

## Operación recomendada
- Configura límites y seguridad HTTP desde `backend/.env` (`CORS_ORIGIN`, `BODY_LIMIT`, `RATE_LIMIT_*`).
- Usa `GET /health/ready` para verificar disponibilidad real de DB en despliegues.
- Si expones `/metrics` fuera de red privada, configura `METRICS_TOKEN`.

## CI (Integración Continua)
- Workflow: `.github/workflows/ci.yml`
- Se ejecuta en `push` y `pull_request` hacia `main` cuando hay cambios en `backend/**`.
- Gates de calidad:
	- `npm ci`
	- `npx prisma generate`
	- `npm run typecheck`
	- `npm test`
	- `npm run audit:high` (no bloqueante; alerta de seguridad)
- Reglas de revisión y ownership: `.github/CODEOWNERS` + `.github/pull_request_template.md`

## Frontend Handoff (Listo para Integrar)
- **Base URL local:** `http://localhost:3000/api/v1`
- **Auth:** enviar JWT de Supabase en `Authorization: Bearer <token>` para rutas `/api/v1/**`.
- **Tenant context:** `gymId` se resuelve desde el token (`auth_user_id`), no se envía manualmente desde frontend.
- **Docs en vivo:** `http://localhost:3000/api-docs`

### Endpoints clave para pantallas iniciales
- **Recepción (búsqueda):** `GET /api/v1/users/search?q=<texto>`
- **Check-in manual/QR:** `POST /api/v1/checkin` con `{ userId, accessMethod?: "MANUAL"|"QR" }`
- **Features por gym (menús dinámicos):** `GET /api/v1/saas/gyms/:id/modules`
- **Baja de plan:** `PATCH /api/v1/users/:id/cancel-subscription`
- **Solicitud de datos (export):** `GET /api/v1/users/:id/data-export`
- **Eliminación de datos (anonimización):** `POST /api/v1/users/:id/anonymize`

### Política de módulos por suscripción
- `modules_config` se calcula automáticamente por `subscription_tier`.
- No se permite override manual por API de negocio.
- La base de datos también está blindada con trigger SQL (`backend/prisma/sql/enforce_modules_config_by_tier.sql`) para evitar drift por cambios directos.

### Flujo de release (staging/prod)
1. Deploy backend.
2. Ejecutar `cd backend && npm run db:enforce-modules`.
3. Validar `GET /api/v1/saas/gyms/:id/modules`.
4. Si falla el paso 2, no cerrar release.

### Recomendación UX/legal de baja de socio
1. Ejecutar `GET /users/:id/data-export` y permitir descarga JSON.
2. Confirmar acción de baja (`cancel-subscription`) con motivo opcional.
3. Si solicita borrado de datos personales, ejecutar `anonymize` (irreversible).
