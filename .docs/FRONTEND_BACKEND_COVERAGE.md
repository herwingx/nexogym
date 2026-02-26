# Cobertura Frontend ↔ Backend (permisos y planes)

Resumen para saber si el flujo del backend está cubierto en el frontend con los permisos correctos según el plan del gym y si el SuperAdmin tiene el control esperado.

---

## 1. Módulos por plan (backend)

El backend expone **solo estos** keys en `modules_config` (según `subscription_tier`):

| Key           | BASIC | PRO_QR | PREMIUM_BIO |
|---------------|-------|--------|-------------|
| `pos`         | ✅    | ✅     | ✅          |
| `qr_access`   | ❌    | ✅     | ✅          |
| `gamification`| ❌    | ✅     | ✅          |
| `classes`     | ❌    | ✅     | ✅          |
| `biometrics`  | ❌    | ❌     | ✅          |

Las rutas del backend que dependen de módulo:

- **pos:** POS, inventario, turnos (shifts).
- **classes:** Booking (clases/reservas), rutinas.
- **biometrics:** Check-in biométrico (hardware).
- **qr_access / gamification:** Usados en check-in (QR, rachas, premios).

El backend **no** envía `analytics`, `crm` ni `portal` en `modules_config`. El frontend los tenía en el store; el menú Admin ya no depende de ellos para Socios, Finanzas ni Auditoría (se muestran siempre para admin; la autorización real es por rol en el backend).

---

## 2. Qué hace el frontend hoy

### 2.1 Menú Admin (`AdminLayout`)

- **Siempre visibles** para quien entra a `/admin` (rol ADMIN o SUPERADMIN): Dashboard, Socios, Finanzas, Auditoría.  
  El backend autoriza por rol (`requireAdminOrSuperAdmin` en finanzas/auditoría; `requireStaff` en users).
- **Condicionados por plan** (según `modules_config` del contexto):
  - **Inventario** y **Cortes de caja** → solo si `modules_config.pos === true`.
  - **Clases** y **Rutinas** → solo si `modules_config.classes === true`.

Si el plan no tiene `pos` o `classes`, esas opciones se ocultan. Si el usuario accede por URL directa a `/admin/classes` o `/admin/routines` sin el módulo habilitado, el frontend redirige a `/admin` antes de llamar la API (evita 403 visible).

### 2.2 Recepción (`ReceptionLayout`)

- Check-in, POS, Socios, Alta siempre visibles para recepcionista/admin.  
  El backend aplica `requireModuleEnabled('pos')` en rutas POS; en check-in valida `qr_access`/`gamification` según el módulo. Si el gym es BASIC, las llamadas a POS fallan con 403 (el menú no filtra por módulo en recepción; opcionalmente se puede ocultar POS cuando `!modules_config.pos`).

### 2.3 Miembro (`MemberLayout`)

- **Plan PRO_QR / PREMIUM_BIO** (`qr_access === true`): Inicio, Premios, Historial, Perfil visibles para el socio.
- **Plan BASIC** (`qr_access === false`): **Portal bloqueado.** El socio ve una pantalla: *"Tu gimnasio está en plan Basic. El portal de socios (QR, premios, historial) no está disponible."* con botón Cerrar sesión. No tiene acceso a ninguna sección del portal.

### 2.4 SuperAdmin (`/saas`)

- Lista de gimnasios, métricas globales, **cambio de tier** por gym (`updateGymTier`).
- **Editar módulos por gym** (`PATCH /saas/gyms/:id/modules` + botón “Editar módulos” en la tabla): el SuperAdmin puede activar o desactivar cada módulo (pos, qr_access, gamification, classes, biometrics) de forma independiente al plan. Los valores se guardan como override en BD; al cambiar el tier, el trigger vuelve a aplicar los defaults del plan (y luego se pueden volver a ajustar con “Editar módulos”).

---

## 3. SuperAdmin: control “independiente del plan”

| Pregunta | Respuesta |
|----------|-----------|
| ¿Puede el SuperAdmin habilitar/deshabilitar opciones **independiente del plan**? | **Sí.** Además del cambio de tier, puede usar **“Editar módulos”** por gym y marcar/desmarcar cada módulo (POS, QR, Gamificación, Clases, Biométrico). El backend guarda el override en `modules_config`; el trigger de BD solo sobrescribe `modules_config` cuando **cambia el tier**, no cuando se actualiza solo `modules_config`. |
| ¿Tiene control de todo lo que el backend expone para SaaS? | **Sí:** listar gimnasios, métricas, cambiar tier, **editar módulos por gym**, crear/editar/eliminar gym, exportar datos del gym. |
| ¿El frontend refleja bien el estado tras cambiar el tier o los módulos? | **Sí.** Tras `updateGymTier` o `updateGymModules`, el frontend actualiza la lista local. La próxima vez que un usuario de ese gym cargue contexto (`/users/me/context`), recibirá el `modules_config` actual. |

**Trigger de BD:** Para que los overrides de módulos persistan, el trigger debe estar aplicado con la lógica “solo recalcular `modules_config` cuando cambia `subscription_tier`”. Ejecutar tras deploy: `cd backend && npm run db:trigger` (aplica `prisma/apply-trigger.ts`).

---

## 4. Resumen para commit del frontend

| Aspecto | Estado |
|---------|--------|
| **Flujo backend cubierto en frontend** | Sí: Admin (socios, finanzas, inventario, turnos, clases, rutinas, auditoría), Recepción (check-in, POS, socios, alta), Miembro (inicio, premios, historial), SuperAdmin (gyms, métricas, cambio de tier). |
| **Permisos por rol** | Sí: rutas protegidas por `AdminRoute`, `ReceptionRoute`, `MemberRoute`; SuperAdmin redirige a `/saas` y tiene su dashboard. La autorización real está en el backend (JWT + rol + módulo). |
| **Menú condicionado por plan** | Sí: Admin oculta Inventario/Cortes si no hay `pos`, y Clases/Rutinas si no hay `classes`. Socios, Finanzas y Auditoría visibles siempre para admin (el backend aplica 403 si no corresponde). |
| **SuperAdmin control total del SaaS** | Sí: listar/**crear gym (con opción de dar de alta al primer admin en el mismo paso)**/editar/eliminar gyms, métricas, cambio de tier y **edición de módulos por gym** (activar/desactivar pos, qr_access, gamification, classes, biometrics independiente del plan). |
| **Bug corregido** | El menú Admin usaba `crm` y `analytics` (que el backend no envía); Socios y Finanzas quedaban siempre ocultos. Se cambió a `moduleKey: null` para Socios, Finanzas y Auditoría para que siempre se muestren a los admins. |

Con esto se puede considerar el frontend alineado con el backend para hacer commit; el SuperAdmin tiene control completo (tier + módulos por gym).
