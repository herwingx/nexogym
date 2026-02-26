# Revisión Final: Roles, Permisos y Deuda Técnica

Revisión completa de permisos backend/frontend, gaps y deuda técnica en el flujo real.

---

## 1. Matriz Backend: API vs Roles

| API | Middleware | SUPERADMIN | ADMIN | RECEPTIONIST | COACH | INSTRUCTOR | MEMBER |
|-----|------------|:----------:|:-----:|:------------:|:-----:|:----------:|:------:|
| **SAAS** |
| GET/POST /saas/* | requireSuperAdmin | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Users** |
| GET /users/me/context | requireAuth | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /users, search, POST, PATCH, send-qr | requireStaff | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| DELETE, regenerate-qr, renew, freeze, unfreeze, cancel, data-export, anonymize, reset-password | requireAdminOrSuperAdmin | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Check-in** |
| POST /checkin | requireStaff | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| GET /checkin/visits | requireStaff | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| POST /checkin/courtesy | ADMIN only (controller) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **POS** |
| /pos/* (products, sales, shifts, expenses) | requireAuth + pos + requireStaff | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| PATCH shifts/:id/force-close, GET shifts/open | requireAdminOrSuperAdmin | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Inventory** |
| GET/POST products, restock, PATCH | requireAuth + pos + requireStaff | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| DELETE products, POST loss | requireAdminOrSuperAdmin | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Analytics** |
| occupancy, revenue/daily | requireAuth | ✅ | ✅ | ✅ | ✅ | ✅ | ❌* |
| financial-report, audit-logs, commissions | requireAdminOrSuperAdmin | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Bookings** |
| GET classes, POST booking, cancel, GET me | requireAuth + classes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST classes, PATCH/DELETE class | requireAdminOrSuperAdmin | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| PATCH :id/attend | requireCoachOrAdmin | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Routines** |
| GET /, member/:id, POST, PATCH, DELETE, exercises | requireCoachOrAdmin | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| GET /me | requireAuth | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Members (portal socio)** |
| /members/* | requireMember | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

\* MEMBER, COACH e INSTRUCTOR no pueden acceder a check-in, POS ni inventario (requireStaff).

---

## 2. Gaps Críticos (Seguridad / Lógica)

### ✅ GAP 1: POST /checkin sin requireStaff — RESUELTO

**Problema (resuelto):** Cualquier usuario autenticado podía hacer check-in de otros socios.

**Fix aplicado:** Se añadió `requireStaff` a `POST /api/v1/checkin`. Solo Admin, Recepcionista o SuperAdmin pueden hacer check-in por QR/manual. El biométrico sigue por `/biometric/checkin` con API key de hardware.

**Archivo:** `backend/src/routes/checkin.routes.ts`

### ✅ GAP 2: INSTRUCTOR sin permisos en backend — RESUELTO

**Problema (resuelto):** INSTRUCTOR no estaba en `requireCoachOrAdmin`, por lo que rutinas y markAttendance devolvían 403.

**Fix aplicado:** Se incluyó INSTRUCTOR en `requireCoachOrAdmin` en `admin.middleware.ts`.

**Archivo:** `backend/src/middlewares/admin.middleware.ts`

### ✅ GAP 3: POS e Inventory sin requireStaff — RESUELTO

**Problema (resuelto):** COACH e INSTRUCTOR podían llamar `/pos/*` e `/inventory/*` por API.

**Fix aplicado:** Se añadió `requireStaff` a todas las rutas de POS e Inventory. Solo Admin o Recepcionista pueden operar POS e inventario.

**Archivos:** `backend/src/routes/pos.routes.ts`, `backend/src/routes/inventory.routes.ts`

---

## 3. Deuda Técnica Frontend

### ✅ AdminMembers / Vista Socios — Resuelto

**Estado:** Conectado a `GET /users?role=MEMBER` (fetchMemberUsers). Admin y Recepción comparten la misma UX de Socios con coherencia de funcionalidades.

**Implementado:**

- Listado paginado (20 por página), orden por nombre, búsqueda por nombre/teléfono.
- Columnas: Nombre, Teléfono, Estado, Plan, Vence, Acciones. Resumen "por vencer (7 días)" y "vencidos".
- Acciones: Renovar / Pagar-Renovar (incl. activos y congelados), Congelar, Descongelar. **Solo Admin:** Cancelar suscripción.
- Editar socio (nombre, teléfono, foto, reenviar QR). **Solo Admin:** Regenerar QR (componente compartido `EditMemberForm`).
- apiClient: `fetchMemberUsers`, `searchMembers`, `renewSubscription`, `freezeSubscription`, `unfreezeSubscription`, `cancelSubscription`; export/anonymize siguen pendientes en UI si se requieren.

### 🟡 ModulesConfig: Mapeo frontend/backend

**Estado:** El backend devuelve `pos`, `qr_access`, `gamification`, `classes`, `biometrics`. El frontend usa `pos`, `classes`, `analytics`, `crm`, `portal`. AuthRestore mapea solo `pos`, `classes`, `analytics`, `crm`, `portal` — algunos no existen en backend.

**Impacto:** Bajo si el menú se basa en `pos` y `classes`. Para gamificación/QR habría que alinear keys o mapear `qr_access`/`gamification` a `portal` o similar.

---

## 4. Matriz Frontend: Rutas vs Roles

| Ruta | AdminRoute | ReceptionRoute | MemberRoute | Roles permitidos |
|------|------------|----------------|-------------|------------------|
| /saas | — | — | — | SUPERADMIN (directo) |
| /admin/* | ✅ | — | — | ADMIN, SUPERADMIN, COACH, INSTRUCTOR |
| /reception/* | — | ✅ | — | RECEPTIONIST, ADMIN, SUPERADMIN. El admin tiene enlace "Check-in" en el sidebar que lleva a /reception. |
| /member/* | — | — | ✅ | MEMBER |

**AdminLayout** filtra menú por rol:

- COACH/INSTRUCTOR: solo Clases, Rutinas
- ADMIN/SUPERADMIN: todo según `modulesConfig`

---

## 5. Checklist de Implementación Completa

### Backend (seguridad) — ✅ Completado

- [x] Añadir `requireStaff` a `POST /checkin`
- [x] Añadir INSTRUCTOR a `requireCoachOrAdmin`
- [x] Añadir `requireStaff` a rutas POS e Inventory

### Frontend (flujo real) — ✅ Completado

- [x] AdminMembers: conectar a GET /users?role=MEMBER y listar socios reales
- [x] AdminMembers: acciones renovar, congelar, descongelar, cancelar (con confirmación)
- [x] apiClient: fetchMemberUsers, renewSubscription, freezeSubscription, unfreezeSubscription, cancelSubscription, exportUserData, anonymizeUserData
- [x] MemberHome, MemberRewards, MemberHistory: quitar mock fallback, mostrar error si falla API

### Documentación

- [ ] Actualizar REVISION_ROLES_FRONTEND_BACKEND.md con esta revisión

---

## 6. Resumen Ejecutivo

| Categoría | Estado | Notas |
|-----------|--------|-------|
| **Seguridad check-in** | ✅ Resuelto | requireStaff en POST /checkin |
| **INSTRUCTOR backend** | ✅ Resuelto | Incluido en requireCoachOrAdmin |
| **POS/Inventory por rol** | ✅ Resuelto | requireStaff en ambas rutas |
| **AdminMembers** | ✅ Resuelto | API real, paginación, búsqueda, editar socio, renovar/congelar/descongelar/cancelar; coherencia con Recepción Socios |
| **apiClient suscripciones** | ✅ Resuelto | renew, freeze, unfreeze, cancel, export, anonymize implementados |
| **Flujo día 0** | ✅ OK | Bootstrap, login, cambio contraseña |
| **Guards frontend** | ✅ OK | AdminRoute, ReceptionRoute, MemberRoute |
| **Leaderboard** | ✅ OK | GET /members/leaderboard implementado |

---

## 7. Changelog de Seguridad (RBAC)

| Fecha | Cambio | Archivos |
|-------|--------|----------|
| 2025-02-25 | requireStaff en POST /checkin (evita check-in por socios) | checkin.routes.ts |
| 2025-02-25 | INSTRUCTOR incluido en requireCoachOrAdmin | admin.middleware.ts |
| 2025-02-25 | requireStaff en rutas POS | pos.routes.ts |
| 2025-02-25 | requireStaff en rutas Inventory | inventory.routes.ts |
| 2025-02-25 | AdminMembers conectado a API real (GET /users?role=MEMBER) | AdminMembers.tsx, apiClient.ts |
| 2025-02-25 | Backend: query param role=MEMBER en GET /users | user.controller.ts |
| 2025-02-25 | MemberHome/Rewards/History: sin mock fallback, error en fallo | MemberHome.tsx, MemberRewards.tsx, MemberHistory.tsx |
| 2025-02-26 | Socios Admin/Recepción: coherencia (búsqueda, paginación, Vence, editar socio); EditMemberForm compartido; solo Admin: Cancelar y Regenerar QR | AdminMembers.tsx, ReceptionMembers.tsx, components/members/EditMemberForm.tsx |
