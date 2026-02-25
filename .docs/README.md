# Índice de documentación

Referencia rápida de los documentos en `.docs/` y cómo encajan entre sí.

---

## Marketing y landing

| Documento | Contenido |
|-----------|-----------|
| **CONTEXTO_MARKETING_LANDING.md** | Contexto de producto para el sitio de marketing y landing: funcionalidades, planes, beneficios, headlines y mensajes clave. |

---

## Arquitectura y producto

| Documento | Contenido |
|-----------|-----------|
| **ARCHITECTURE.md** | Visión general del sistema, capas, multitenancy. |
| **ARCHITECTURE_REVIEW_NEXOGYM.md** | Revisión de arquitectura del producto. |
| **PRD.md** | Product Requirements Document. |
| **DATABASE_SCHEMA.md** | Modelo de datos Prisma: enums, tablas, acciones auditadas. Incluye **ExpenseType**, **Expense**, **CashShift** (expected_balance), **SHIFT_CLOSED** / **SHIFT_FORCE_CLOSED** / **USER_SOFT_DELETED**. |

---

## API y contratos

| Documento | Contenido |
|-----------|-----------|
| **API_SPEC.md** | Contratos de la API por sprint: check-in, POS, turnos, users, members, bookings, routines, SaaS. Incluye **cierre ciego** (POST /pos/shifts/close), **force-close**, **POST /pos/expenses** (tipos), **GET /users?role_not=MEMBER**, **DELETE /users/:id**. |

---

## Caja, turnos y stock

| Documento | Contenido |
|-----------|-----------|
| **CORTES_CAJA_Y_STOCK.md** | Flujo de turnos, stock al vender, **cierre ciego** (recepcionista no ve saldo esperado), **tipos de egreso** (SUPPLIER_PAYMENT, OPERATIONAL_EXPENSE, CASH_DROP), **Forzar Cierre** y **Personal** (/admin/staff). Secciones 4–9: cierre ciego, tipos de egreso, controles admin, cerrar sesión, resumen, referencia técnica. |

---

## Auth y Supabase

| Documento | Contenido |
|-----------|-----------|
| **SUPABASE_AUTH_EN_EL_PROYECTO.md** | Cómo interactúa Supabase Auth con el proyecto: flujo login → token → backend, enlace `auth_user_id`, ventajas frente a implementar login propio, variables de entorno. |
| **BOOTSTRAP_PRODUCCION_PRIMER_ADMIN.md** | Primer arranque con DB vacía en producción: seed, SuperAdmin, cómo crear tu usuario admin de un gym (opciones y checklist). |

---

## Roles, permisos y usuarios

| Documento | Contenido |
|-----------|-----------|
| **SEED_USERS_AND_ROLES.md** | Roles (SUPERADMIN, ADMIN, RECEPTIONIST, **COACH**, **INSTRUCTOR**, MEMBER), planes, credenciales de seed. Incluye acceso **COACH/INSTRUCTOR** a /admin con menú limitado (Clases, Rutinas) y vista **Personal** para admin. |
| **RECEPTIONIST_PERMISSIONS_ANALYSIS.md** | Matriz Recepcionista vs Admin: check-in, caja (cierre ciego, egresos tipados, forzar cierre), socios, inventario. |
| **REVISION_ROLES_FRONTEND_BACKEND.md** | Revisión por rol: qué puede hacer cada uno en frontend y backend, gaps (Admin Members mock, INSTRUCTOR en backend), checklist. |

---

## Frontend e integración

| Documento | Contenido |
|-----------|-----------|
| **FRONTEND_INTEGRATION.md** | Integración frontend con la API. |
| **REVISION_FRONTEND_POS_Y_STAFF.md** | Revisión frontend ↔ backend: egresos, cierre ciego, force close, personal; correcciones aplicadas (ocultar “Esperado”, parseo efectivo, confirmación dar de baja). |
| **UI_UX_GUIDELINES.md** | Guías de UI/UX del proyecto. |
| **SILEO_TOAST.md** | Uso de toasts (Sileo) en la app. |
| **SKELETONS.md** | Componentes de carga (skeletons). |

---

## Suscripciones, billing y seguridad

| Documento | Contenido |
|-----------|-----------|
| **SUBSCRIPTION_EXPIRY_AND_RENEWAL.md** | Vencimiento y renovación de suscripciones. |
| **REFACTOR_BILLING_RBAC_CHECKIN.md** | Refactor de billing, RBAC y check-in. |
| **FRONTEND_SECURITY_AUDIT.md** | Auditoría de seguridad frontend. |
| **SECURITY_HEADERS.md** | Headers de seguridad. |

---

## Otros

| Documento | Contenido |
|-----------|-----------|
| **MEMBER_QR_ACCESS.md** | Acceso del socio por QR. |
| **EMAIL_POLITICA_GYM.md** | Política de email del gym. |
| **TESTING_STRATEGY.md** | Estrategia de pruebas. |
| **DEV_WORKFLOW.md** | Flujo de desarrollo. |
| **GO_LIVE_CHECKLIST.md** | Checklist para puesta en producción. |
| **BRANCH_PROTECTION.md** | Protección de ramas. |
| **FRONTEND_BACKEND_COVERAGE.md** | Cobertura frontend/backend. |

---

## Cambios recientes (POS, caja, personal, roles)

- **Cierre ciego:** Recepcionista no ve saldo esperado; solo envía efectivo contado; backend no devuelve reconciliación si rol RECEPTIONIST.
- **Tipos de egreso:** SUPPLIER_PAYMENT, OPERATIONAL_EXPENSE, CASH_DROP; descripción obligatoria para los dos primeros.
- **Forzar cierre:** Admin puede cerrar un turno abierto desde Cortes de caja (PATCH /pos/shifts/:id/force-close).
- **Personal (/admin/staff):** Listado de staff (role_not=MEMBER), dar de baja (soft delete), badge INACTIVO.
- **COACH / INSTRUCTOR:** Acceso a /admin con menú limitado (solo Clases y Rutinas); defaultPath /admin/routines; AdminDashboard redirige a rutinas si el rol es COACH o INSTRUCTOR.

Para más detalle técnico: **CORTES_CAJA_Y_STOCK.md**, **API_SPEC.md**, **REVISION_ROLES_FRONTEND_BACKEND.md**, **REVISION_FRONTEND_POS_Y_STAFF.md**.
