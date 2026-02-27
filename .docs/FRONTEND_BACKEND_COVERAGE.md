# Cobertura Frontend ↔ Backend (permisos y planes)

Resumen para saber si el flujo del backend está cubierto en el frontend con los permisos correctos según el plan del gym y si el SuperAdmin tiene el control esperado.

---

## Protección por plan (resumen)

**Todo lo que no está en el plan del gym está protegido** para staff, socios y admins:

- **Backend:** Las rutas que dependen de un módulo (`pos`, `qr_access`, `gamification`, `classes`, `biometrics`) usan `requireModuleEnabled(moduleKey)`. Si el gym no tiene ese módulo en su plan (o en el override de SuperAdmin), la API responde **403**.
- **Frontend:** El menú y las rutas condicionadas por plan se ocultan o redirigen: Admin (Inventario, Cortes, Clases, Rutinas, Gamificación), Recepción (POS), y el portal del socio completo en plan BASIC.
- **Socios:** En plan BASIC no pueden usar el portal (pantalla de bloqueo en la app y 403 en todas las rutas `/api/v1/members/*`).
- Lo que marca qué puede hacer cada gym es el **plan** (y los overrides de módulos que aplique el SuperAdmin).

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

Las rutas del backend que dependen de módulo están protegidas con **`requireModuleEnabled(moduleKey)`**: si el plan del gym no incluye el módulo, la API responde **403** con mensaje `Feature disabled for current subscription: <module>`.

- **pos:** `/api/v1/pos/*`, `/api/v1/inventory/*` (POS, inventario, turnos).
- **classes:** `/api/v1/bookings/*`, `/api/v1/routines/*` (clases, reservas, rutinas).
- **gamification:** `/api/v1/gym/rewards-config` (premios por racha).
- **qr_access:** `/api/v1/members/*` (portal del socio: perfil, historial, leaderboard, reenviar QR). En plan BASIC el socio no puede usar ninguna ruta del portal.
- **biometrics:** Check-in biométrico (hardware).

El check-in (`POST /api/v1/checkin`) no exige módulo a nivel de ruta: en BASIC se permite check-in manual; si el método es QR se valida `qr_access` dentro del controller (403 si no está en el plan).

El backend **no** envía `analytics`, `crm` ni `portal` en `modules_config`. El frontend los tenía en el store; el menú Admin ya no depende de ellos para Socios, Finanzas ni Auditoría (se muestran siempre para admin; la autorización real es por rol en el backend).

---

## 2. Qué hace el frontend hoy

### 2.1 Menú Admin (`AdminLayout`)

- **Siempre visibles** para quien entra a `/admin` (rol ADMIN o SUPERADMIN): Dashboard, Socios, Finanzas, Auditoría.  
  El backend autoriza por rol (`requireAdminOrSuperAdmin` en finanzas/auditoría; `requireStaff` en users).
- **Condicionados por plan** (según `modules_config` del contexto):
  - **Inventario** y **Cortes de caja** → solo si `modules_config.pos === true`. Si se accede por URL directa sin el módulo, se redirige a `/admin`.
  - **Clases** y **Rutinas** → solo si `modules_config.classes === true`. Redirección a `/admin` si se accede sin el módulo.
  - **Gamificación** → solo si `modules_config.gamification === true`. Sin módulo se muestra mensaje de no disponible.

Si el plan no tiene el módulo, esas opciones se ocultan en el menú y el acceso directo por URL redirige o muestra mensaje (evita 403 visible).

### 2.2 Recepción (`ReceptionLayout`)

- **Check-in, Socios, Alta** siempre visibles (check-in manual funciona en todos los planes).
- **POS** solo visible si `modules_config.pos === true`. Si se accede por URL a `/reception/pos` sin el módulo, se redirige a `/reception`.
- **Leaderboard** visible solo si `modules_config.gamification === true` y el staff tiene permiso `can_view_leaderboard`. Ruta `/reception/leaderboard` (queda en Recepción, no redirige al panel admin).
- AdminLayout y ReceptionLayout aplican `p-4 sm:p-6` al área de contenido para márgenes consistentes en todas las vistas.

### 2.3 Miembro (`MemberLayout`)

- **Plan PRO_QR / PREMIUM_BIO** (`qr_access === true`): Inicio, Premios, Historial, Perfil visibles. Las rutas `/api/v1/members/*` están permitidas.
- **Plan BASIC** (`qr_access === false`): **Portal bloqueado.** El frontend muestra la pantalla *"Tu gimnasio está en plan Basic. El portal de socios (QR, premios, historial) no está disponible."* con botón Cerrar sesión. El backend además aplica `requireModuleEnabled('qr_access')` a todas las rutas `/api/v1/members/*`, de modo que cualquier petición directa a la API del portal (perfil, historial, leaderboard, reenviar QR) recibe **403** si el gym es BASIC.

### 2.4 SuperAdmin (`/saas`)

- Lista de gimnasios, métricas globales, **cambio de tier** por gym (`updateGymTier`).
- **Editar módulos por gym** (`PATCH /saas/gyms/:id/modules` + botón “Editar módulos” en la tabla): el SuperAdmin puede activar o desactivar cada módulo (pos, qr_access, gamification, classes, biometrics) de forma independiente al plan. Los valores se guardan como override en BD; al cambiar el tier, el trigger vuelve a aplicar los defaults del plan (y luego se pueden volver a ajustar con “Editar módulos”).

---

## 3. SuperAdmin: control “independiente del plan”

| Pregunta | Respuesta |
|----------|-----------|
| ¿Puede el SuperAdmin habilitar/deshabilitar opciones **independiente del plan**? | **Sí.** Además del cambio de tier, puede usar **“Editar módulos”** por gym y marcar/desmarcar cada módulo (POS, QR, Gamificación, Clases, Biométrico). El backend guarda el override en `modules_config`; el trigger de BD solo sobrescribe `modules_config` cuando **cambia el tier**, no cuando se actualiza solo `modules_config`. |
| ¿Tiene control de todo lo que el backend expone para SaaS? | **Sí:** listar gimnasios, métricas, cambiar tier, **editar módulos por gym**, crear/editar/eliminar gym, exportar datos del gym. |
| ¿El frontend refleja bien el estado tras cambiar el tier o los módulos? | **Sí.** Al cambiar el plan (`updateGymTier`), el backend devuelve el gym actualizado (con `subscription_tier` y `modules_config` del plan); el frontend actualiza la fila en la tabla con esa respuesta para que los módulos se vean al instante. Tras `updateGymModules` también se actualiza la lista local. La próxima vez que un usuario de ese gym cargue contexto (`/users/me/context`), recibirá el `modules_config` actual. |

**Trigger de BD:** Para que los overrides de módulos persistan, el trigger debe estar aplicado con la lógica “solo recalcular `modules_config` cuando cambia `subscription_tier`”. Ejecutar tras deploy: `cd backend && npm run db:trigger` (aplica `prisma/apply-trigger.ts`).

### Cuándo se actualiza el acceso para los usuarios del gym

- **No se cierra sesión a nadie.** Al bajar de plan o quitar módulos, los usuarios ya logueados (admin, recepción, socios) siguen con la misma sesión.
- **Cuándo ven el cambio:** El contexto (`modules_config`) se carga solo al **iniciar sesión** o al **recargar la app** (AuthRestore). Hasta que no recarguen la página, en el store siguen el `modules_config` anterior; el menú puede seguir mostrando opciones que ya no tienen.
- **Si intentan usar algo deshabilitado:** En cuanto hacen una acción que llama al backend (abrir POS, inventario, cortes, portal del socio, premios, etc.), el backend lee el plan actual del gym y aplica `requireModuleEnabled`. Si el módulo está deshabilitado, responde **403** y el frontend muestra la pantalla de "no está en tu plan" (PlanRestrictionCard). El acceso real se quita en la siguiente petición.
- **Recomendación:** Para que el menú se actualice de inmediato para todos, que recarguen la página o cierren sesión y vuelvan a entrar.

### Corte de caja (turno) al quitar POS o hacer downgrade

- **Downgrade:** Al bajar de plan, el frontend muestra un **modal de confirmación** con las acciones que se ejecutarán (cierre automático de turnos abiertos, actualización de módulos, etc.). Al aceptar, el backend cierra todos los turnos abiertos del gym y aplica el nuevo tier. No hay botón separado «Cerrar turnos» en Super Admin; todo va en el flujo de cambio de plan.
- **Upgrade:** Subir de plan **no afecta** los turnos de caja; solo da acceso a más módulos (QR, gamificación, clases, biométrico). No se cierra ningún turno ni se pide confirmación.
- **Desactivar POS en Módulos:** Si Super Admin desactiva el módulo POS desde Módulos, el backend cierra automáticamente los turnos abiertos antes de aplicar el cambio.
- Recepción y Admin del gym pierden acceso a POS y Cortes cuando el plan ya no los incluye (menú se oculta, rutas 403). Los turnos quedan cerrados; no hay registros OPEN colgados.

---

## 4. Resumen para commit del frontend

| Aspecto | Estado |
|---------|--------|
| **Flujo backend cubierto en frontend** | Sí: Admin (socios, finanzas, inventario, turnos, clases, rutinas, gamificación — premios por racha, auditoría), Recepción (check-in, POS, socios, alta), Miembro (inicio, premios con hitos y participación por racha, historial), SuperAdmin (gyms, métricas, cambio de tier). |
| **Permisos por rol** | Sí: rutas protegidas por `AdminRoute`, `ReceptionRoute`, `MemberRoute`; SuperAdmin redirige a `/saas` y tiene su dashboard. La autorización real está en el backend (JWT + rol + módulo). |
| **Menú condicionado por plan** | Sí: Admin oculta Inventario/Cortes si no hay `pos`, Clases/Rutinas si no hay `classes`, y Gamificación si no hay `gamification`. Socios, Finanzas y Auditoría visibles siempre para admin (el backend aplica 403 si no corresponde). |
| **SuperAdmin control total del SaaS** | Sí: listar/**crear gym (con opción de dar de alta al primer admin en el mismo paso)**/editar/eliminar gyms, métricas, cambio de tier y **edición de módulos por gym** (activar/desactivar pos, qr_access, gamification, classes, biometrics independiente del plan). |
| **Bug corregido** | El menú Admin usaba `crm` y `analytics` (que el backend no envía); Socios y Finanzas quedaban siempre ocultos. Se cambió a `moduleKey: null` para Socios, Finanzas y Auditoría para que siempre se muestren a los admins. |

Con esto se puede considerar el frontend alineado con el backend para hacer commit; el SuperAdmin tiene control completo (tier + módulos por gym).
