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
