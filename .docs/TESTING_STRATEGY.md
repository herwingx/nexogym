# Estrategia de Pruebas (Automated QA & Swagger)

**Objetivo:** Garantizar la estabilidad financiera y operativa del ERP sin caer en la parálisis de intentar lograr un 100% de cobertura. Usaremos "Pruebas de Ruta Crítica" combinadas con documentación viva.

## 1. Documentación Viva (Manual Testing)
- **Herramienta:** Swagger (OpenAPI 3.0) vía `swagger-ui-express` y `swagger-jsdoc`.
- **Regla:** Absolutamente todo nuevo endpoint en `routes/` DEBE tener su bloque de comentarios JSDoc (`@swagger`) definiendo el request, las respuestas (200, 400, 403) y la seguridad (BearerAuth).

## 2. Pruebas Automatizadas (Unit & Integration)
- **Stack:** Vitest + Supertest + `vitest-mock-extended` (para Prisma).
- **Estructura:** Los archivos de prueba deben vivir junto al controlador que prueban (ej. `checkin.controller.test.ts`).
- **Enfoque de la IA:** Al generar el código para los Sprints que involucren lógica de negocio compleja, se debe generar automáticamente el archivo `.test.ts` correspondiente.

## 3. Casos de Uso Críticos Obligatorios:
1. **Motor de Gamificación (`checkin.controller.test.ts`):**
   - Test: "Debe sumar +1 al streak si la última visita fue exactamente ayer".
   - Test: "Debe reiniciar el streak a 1 si la última visita fue hace más de 48 horas".
   - Test: "Debe devolver error 403 si la suscripción está expirada".
2. **Motor Financiero (`shift.controller.test.ts`):**
   - Test: "Debe calcular correctamente el `expected_balance` sumando ventas y restando gastos del turno actual".
3. **Multitenancy Estricto:**
   - Test: "Debe fallar o devolver vacío si un Admin intenta consultar datos enviando un `gym_id` diferente al suyo en el JWT".

## 4. Cobertura Fase 2 (Hardening)
1. **SaaS Feature Flags y métricas (`saas.controller.test.ts`)**
   - Verificar `modules_config` automático por `subscription_tier`.
   - Verificar overwrite de módulos al cambiar tier.
   - Verificar respuesta de `getGlobalMetrics`.
2. **Booking Tenant Isolation (`booking.controller.test.ts`)**
   - Verificar que búsquedas y conteos se ejecuten con `gym_id`.
3. **Auth con Supabase (`auth.middleware.test.ts`)**
   - Verificar mapeo `auth_user_id` → usuario interno y contexto `req.gymId` / `req.userRole`.
4. **CRM y operaciones financieras**
   - `user.controller.test.ts`: actualización de `profile_picture_url` + auditoría.
   - `pos.controller.test.ts`: flujo de fallo cuando no hay turno abierto.

## 5. Convenciones de Tipado en Tests
- Evitar depender de enums importados de Prisma en tests unitarios cuando el entorno de tipos pueda ir desfasado.
- Preferir literales del dominio (`'ACTIVE'`, `'PRO_QR'`, `'PREMIUM_BIO'`) y validar comportamiento del controlador.

## 6. Tests de Infraestructura (Fase 3)
- `rate-limit.middleware.test.ts`: valida política de límite por IP y respuesta `429`.
- `utils/http.test.ts`: valida formato de error estandarizado y logging estructurado.
- Recomendación: mantener estas pruebas como "guardrails" para cambios de seguridad/operación.

## 7. Observabilidad (Fase 4)
- `observability/metrics.test.ts`: valida instrumentación HTTP y exposición de métricas registradas.

## 8. Pipeline CI (Calidad continua)
- Definido en `.github/workflows/ci.yml`.
- Se ejecuta en cambios de backend para `push` y `pull_request` a `main`.
- Orden de validación:
   1. Instalación limpia de dependencias (`npm ci`).
   2. Generación Prisma Client (`npx prisma generate`).
   3. Type checking estricto (`npm run typecheck`).
   4. Test suite completa (`npm test`).
   5. Security audit high (`npm run audit:high`, modo informativo/no bloqueante).
