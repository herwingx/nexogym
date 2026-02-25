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
   - `member.controller.test.ts`: getMemberProfile devuelve 404 si el usuario no existe o no pertenece al gym; getMemberHistory filtra por `user_id` y `gym_id`.

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
   - `member.controller.test.ts`: portal del socio — 401 sin auth, 404 tenant isolation, 200 perfil con membership_status y next_reward, historial paginado.

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

---

## 9. Qué falta (cobertura por fases) y por qué

Las secciones 3–4 definen casos críticos obligatorios; las secciones 4 (Fase 2), 6 (Fase 3) y 7 (Fase 4) son cobertura adicional por prioridad. Esta tabla resume qué tests pueden no estar aún implementados y por qué.

| Qué puede faltar | Dónde implementarlo | Por qué no está necesariamente hecho |
|------------------|---------------------|--------------------------------------|
| **Tests Fase 2** (SaaS feature flags, booking tenant isolation, auth middleware, CRM/finanzas) | Archivos `*.controller.test.ts` y `auth.middleware.test.ts` junto a cada módulo | Son parte del “hardening”; se priorizan después de los casos críticos de la sección 3. Revisar qué archivos existen y cuáles de estos casos están cubiertos. |
| **Tests Fase 3** (rate-limit, http utils) | `rate-limit.middleware.test.ts`, `utils/http.test.ts` | Guardrails de seguridad/operación; se añaden cuando se considera necesario. |
| **Tests Fase 4** (observabilidad) | `observability/metrics.test.ts` | Depende de que el módulo de métricas esté estable; no bloquea el CI inicial. |
| **Documentación Swagger (JSDoc @swagger)** en cada endpoint nuevo | En los archivos de `routes/` y controladores | Regla del doc: todo endpoint debe tener su bloque JSDoc. Si algún endpoint no lo tiene, falta añadirlo; es responsabilidad al añadir o modificar rutas. |
| **E2E / tests de integración frontend** | Repo frontend o proyecto aparte | Este doc se centra en backend (Vitest + Supertest). E2E es otro esfuerzo; ver FRONTEND_INTEGRATION.md. |

**Resumen:** Lo que “falta” son tests y documentación Swagger que se van cubriendo por fases o al tocar cada módulo. No hay un único cambio que “cierre” todo; conviene revisar periódicamente qué archivos `.test.ts` existen y qué bloques `@swagger` faltan en rutas nuevas.
