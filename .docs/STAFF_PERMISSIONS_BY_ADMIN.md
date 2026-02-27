# Permisos de staff configurables por el Admin

El admin del gym puede **activar o desactivar módulos por persona** para el personal (Recepción, Coach, Instructor, Limpieza). Así una misma persona puede tener una sola cuenta y hacer varias funciones: por ejemplo un coach que también vende en mostrador, o un recepcionista que también edita rutinas.

---

## 1. Comportamiento por defecto (al crear personal)

Al crear staff desde **Personal → Agregar personal**, cada rol tiene sus opciones por defecto:

| Rol            | Recepción (check-in, POS, socios) | Inventario y cortes | Clases y rutinas |
|----------------|-----------------------------------|---------------------|------------------|
| **Recepcionista** | Sí                                 | Sí                  | No               |
| **Coach**        | No                                 | No                  | Sí               |
| **Instructor**   | No                                 | No                  | Sí               |
| **Limpieza**     | No                                 | No                  | No               |

**Limpieza:** Personal de limpieza. Por defecto sin acceso a módulos; solo aparece en el listado, recibe QR (cuando se implemente) para checada de asistencia y queda en auditoría. El admin puede darle permisos extra si hace labores adicionales (p. ej. recepción).

---

## 2. Cómo cambiar permisos

1. Ir a **Admin → Personal**.
2. En la fila del usuario (Recepción, Coach, Instructor o Limpieza), clic en **Permisos**.
3. Marcar o desmarcar en el modal (secciones **Módulos principales** y **Permisos adicionales**):

   **Módulos principales**
   - **Recepción** — Check-in, socios, alta de socios y POS. Todo el flujo de mostrador.
   - **Inventario y cortes** — Gestión de productos, stock y cortes de caja en el panel admin.
   - **Clases y rutinas** — Crear y gestionar clases grupales y rutinas de entrenamiento.

   **Permisos adicionales**
   - **Dashboard** — Métricas, ocupación y resumen. Necesario para ver el aforo en Check-in (también lo obtiene quien tenga Recepción).
   - **Socios (admin)** — Ver y editar socios en el panel admin (recepción ya incluye socios en su flujo).
   - **Finanzas** — Reportes, ingresos y comisiones.
   - **Personal** — Ver, crear y editar permisos. Dar de baja solo Admin.
   - **Auditoría** — Registro de acciones (solo lectura).
   - **Gamificación** — Configurar premios por racha.
   - **Leaderboard** — Ver ranking de rachas. Aparece en Admin y en Recepción (`/reception/leaderboard`).

4. **Guardar**. Los cambios aplican en el próximo inicio de sesión (o al recargar).

### Clases y Rutinas en recepción

Si el staff tiene **Clases y rutinas** activado y el gym tiene el módulo `classes`, verá las opciones **Clases** y **Rutinas** en el menú de recepción (`/reception/classes`, `/reception/routines`), sin pasar por el panel admin.

**Importante:** El staff con permisos puede ver y editar según lo asignado. Las acciones destructivas (eliminar, dar de baja, cancelar suscripción, anonimizar, regenerar QR) están reservadas al Admin. Todo queda registrado en auditoría.

---

## 3. Backend

- **Campo en BD:** `User.staff_permissions` (JSON opcional). Claves: `can_use_pos`, `can_use_routines`, `can_use_reception`, `can_view_dashboard`, `can_view_members_admin`, `can_use_finance`, `can_manage_staff`, `can_view_audit`, `can_use_gamification`, `can_view_leaderboard`.
- **Endpoint:** `PATCH /api/v1/users/:id/staff-permissions` (Admin o staff con can_manage_staff). Body con las claves booleanas que se quieran actualizar.
- **Contexto de sesión:** `GET /users/me/context` devuelve en `user` los campos `staff_permissions` y `effective_staff_permissions` (permisos efectivos ya calculados).
- Las rutas de POS, inventario, check-in, rutinas y reservas usan middlewares que comprueban estos permisos efectivos (no solo el rol).
- **Instructores para Clases:** `GET /users/instructors` lista solo COACH e INSTRUCTOR; requiere `can_use_routines`. Así un coach puede usar Clases y elegir instructores en el formulario sin necesitar `can_use_reception` (que usaría `GET /users?role_not=MEMBER`).

---

## 4. Roles fijos

Los roles son fijos: Recepción, Coach, Instructor, Limpieza. El admin elige uno al crear staff. No se prevé que el admin cree roles personalizados; los roles comunes de un gym están cubiertos.

---

## 5. Resumen

- **Por defecto** cada rol tiene sus módulos habituales; no hace falta tocar nada si no hay mezcla de funciones.
- **Si la misma persona hace varias cosas** (p. ej. coach + ventas, o recepcionista + rutinas), el admin activa los permisos extra en Personal → Permisos.
- **Limpieza** es un rol con permisos mínimos por defecto; ideal para personal que solo necesita checada de asistencia (QR) y aparecer en auditoría.
- **Permisos adicionales** permiten dar acceso a Dashboard, Socios admin, Finanzas, Personal, Auditoría, Gamificación o Leaderboard (rachas) a staff de confianza.
- **Eliminar/dar de baja** siempre es solo Admin; el staff puede ver, crear y editar según sus permisos.
- Una sola cuenta por persona, sin duplicar roles.
