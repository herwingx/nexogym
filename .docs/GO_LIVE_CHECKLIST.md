# Go-Live Checklist (Backend)

Este documento define qué falta para considerar el backend “listo para producción” sin seguir cambiando lógica de negocio.

## 1) Estado técnico actual (completado)

- Arquitectura multitenant implementada y probada.
- Auth con Supabase endurecida (`auth_user_id` + contexto interno).
- Feature flags por plan (`modules_config`) y actualización automática por tier.
- Anti-passback en check-in + payload visual para recepción.
- Rate limiting configurado para API general, check-in y biométrico.
- Health y readiness (`/health`, `/health/ready`).
- Observabilidad con métricas Prometheus (`/metrics`, con token opcional).
- CI en GitHub Actions con typecheck + tests + audit informativo.
- Suite de pruebas en verde.

## 2) Requisitos de operación antes de go-live (sin tocar backend)

Estos puntos son de configuración/operación, no de desarrollo:

1. Activar branch protection en `main` según `.docs/BRANCH_PROTECTION.md`.
2. Configurar variables/secrets reales en GitHub para CI/CD (DB, Supabase, etc.).
3. Definir entorno de staging y validar smoke tests post-deploy.
4. Configurar monitoreo y alertas:
   - disponibilidad (`/health`, `/health/ready`)
   - tasa de errores 5xx
   - latencia p95
5. Definir backups y pruebas de restore para PostgreSQL/Supabase.
6. Acordar ventana y plan de rollback de primer despliegue productivo.

## 2.1) Paso obligatorio de release (staging/prod)

Para evitar drift de `modules_config` y asegurar que el plan gobierna features:

1. Desplegar backend.
2. Ejecutar guard DB de módulos por tier:
   - `cd backend && npm run db:enforce-modules`
3. Verificar endpoint de lectura de módulos por gym:
   - `GET /api/v1/saas/gyms/:id/modules`
4. Si el paso 2 falla, **el release no se considera completo**.

## 3) Variables mínimas obligatorias para producción

- `NODE_ENV=production`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `CORS_ORIGIN` (NO usar `*` en producción pública)
- `METRICS_ENABLED=true`
- `METRICS_TOKEN` (si `/metrics` será accesible fuera de red interna)

## 4) Smoke tests de salida

Tras cada deploy, validar:

1. `GET /health` => 200
2. `GET /health/ready` => 200
3. `GET /api-docs` accesible
4. `POST /api/v1/checkin` (caso válido y caso anti-passback)
5. `GET /api/v1/saas/metrics` con credenciales superadmin
6. `GET /metrics` con token (si está protegido)
7. `GET /api/v1/saas/gyms/:id/modules` responde 200 y consistente con el tier

## 5) Criterio de “backend freeze”

Se considera backend congelado cuando:

- CI está verde de forma estable.
- Checklist de operación (sección 2) está 100% aplicado.
- Smoke tests pasan en staging y en producción inicial.

A partir de ese punto:

- No se hacen cambios funcionales de backend salvo bug crítico o incidente.
- Todo cambio posterior entra por PR con test y actualización de docs obligatoria.

## 6) Cuándo sí romper el freeze

Solo en estos casos:

- Incidente en producción (P0/P1).
- Vulnerabilidad de seguridad confirmada.
- Cambio legal/compliance obligatorio.
- Requisito comercial crítico aprobado por producto + técnico.
