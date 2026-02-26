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

### 2.0) Qué falta y por qué (revisión posterior)

Todo lo anterior se hace **fuera del código**; esta tabla indica qué es cada punto y por qué no está “hecho” en el repo.

| Qué falta | Dónde hacerlo | Por qué no está en el repo |
|-----------|----------------|----------------------------|
| **Branch protection** | GitHub → Repository → Settings → Branches | Son reglas de la plataforma GitHub; no se pueden definir en código (sí se puede documentar, como en BRANCH_PROTECTION.md). |
| **Variables/secrets para CI/CD** | GitHub → Repository → Settings → Secrets and variables → Actions (y panel del hosting para prod) | Los secrets no deben vivir en el repo por seguridad; se configuran en cada entorno. |
| **Entorno de staging + smoke tests** | Infra / hosting (Railway, Render, Vercel, etc.) | Definir el servicio, la URL y el pipeline de deploy es configuración de infra; el repo solo tiene el código y los scripts de test. |
| **Monitoreo y alertas** | Herramienta de observabilidad (Datadog, Grafana, Uptime Robot, etc.) | Configurar dashboards, umbrales y alertas es operación; el backend ya expone `/health`, `/metrics`. |
| **Backups y pruebas de restore** | Supabase (Dashboard → Database → Backups) y/o scripts propios + cron | Política de backups depende del proveedor y del contrato; no es código de la app. |
| **Ventana y plan de rollback** | Acuerdo interno (documento operativo o wiki) | Proceso humano y organizativo; no automatizable en el repo. |
| **Paso obligatorio `db:enforce-modules`** (sección 2.1) | Ejecutar manualmente o en script de release tras cada deploy | El comando está en el repo (`npm run db:enforce-modules`); lo que “falta” es que alguien (o el pipeline) lo ejecute en cada release; depende de cómo definas el proceso de deploy. |

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
- `SUPABASE_SERVICE_ROLE_KEY` (opcional; necesario para crear el primer admin al dar de alta un gym desde /saas; si no está, el gym se crea pero el admin debe darse con el script `create-gym-admin`)

## 3.1) Primer arranque en producción (DB vacía)

Antes de los smoke tests, si la base de datos está vacía:

1. Ejecutar `npm run db:push` (o `prisma migrate deploy`).
2. Ejecutar `npm run bootstrap-superadmin` con variables de producción:
   ```bash
   SUPERADMIN_EMAIL=ops@tudominio.com SUPERADMIN_PASSWORD=... npm run bootstrap-superadmin
   ```
3. Probar login en el frontend → acceder a `/saas` y cambiar contraseña en el primer login.

Documentación completa: `.docs/BOOTSTRAP_PRODUCCION_PRIMER_ADMIN.md`.

---

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
