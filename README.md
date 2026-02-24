# GymSaaS ERP - Profesional Backend

ERP Multitenant de alto rendimiento para la gestión de gimnasios.

## Comandos Rápidos

- `npm install` - Instala dependencias.
- `npm run dev` - Levanta el servidor de desarrollo (tsx).
- `npm test` - Corre la suite de pruebas (Vitest).
- `npm run test:coverage` - Reporte de cobertura de código.
- `npx prisma migrate dev` - Aplica cambios en la base de datos.

## Documentación
- **API (Swagger):** `http://localhost:3000/api-docs`
- **Health:** `http://localhost:3000/health`
- **Readiness:** `http://localhost:3000/health/ready`
- **Metrics (Prometheus):** `http://localhost:3000/metrics`
- **Estrategia de Pruebas:** [TESTING_STRATEGY.md](./.docs/TESTING_STRATEGY.md)
- **Schema DB:** [DATABASE_SCHEMA.md](./.docs/DATABASE_SCHEMA.md)
- **Branch Protection:** [BRANCH_PROTECTION.md](./.docs/BRANCH_PROTECTION.md)

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
