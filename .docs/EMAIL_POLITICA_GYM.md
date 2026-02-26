# Gestión de correos: política por gym

Recomendación para que el correo de acceso sea de la **empresa (gym)** y no del individuo, de modo que al dar de baja a alguien el gym conserve el control del correo.

> Ver **CANALES_COMUNICACION.md** para la estrategia completa: Email solo para bienvenida y reset contraseña; WhatsApp para QR y cumpleaños. **Staff:** Admin entrega credenciales en persona, reset al correo del Admin.

---

## 1. Recomendación: correos corporativos del gym

- **Ideal:** Que staff (admin, recepcionistas, instructores) usen **correos con dominio del gym**, por ejemplo:
  - `admin@migym.com`
  - `recep@migym.com` o `recep1@migym.com`, `recep2@migym.com` si hay varios
  - `instructor@migym.com`

- **Para staff (Recep, Coach, Instructor):** El Admin **no les envía correo**. Les da usuario y contraseña en persona. Si olvidan contraseña, el Admin resetea y la **nueva contraseña llega al correo del Admin** (no al staff). Ver CANALES_COMUNICACION.md.

- **Ventajas:**
  - El correo **pertenece al gym**, no a la persona.
  - Si despiden a alguien: dan de baja el usuario en la app (soft delete) y el gym **conserva el correo**. Pueden reasignar ese mismo correo a otra persona.

---

## 2. Cómo está hoy el sistema

- El **email** no se guarda en nuestra tabla `User`; vive solo en **Supabase Auth**.
- El vínculo es `User.auth_user_id` → id del usuario en Supabase Auth (donde está el email y la contraseña).
- Al dar de baja: hacemos **soft delete** del `User` en nuestro backend; la persona deja de poder entrar porque el backend solo acepta usuarios con `deleted_at: null`. La cuenta en Supabase (email + contraseña) sigue existiendo.
- Si el correo es **corporativo**, el gym puede:
  1. **Restablecer contraseña** en Supabase (panel o “olvidé mi contraseña”) y dar la nueva a otra persona; luego en nuestra app crear un **nuevo User** (nuevo recepcionista) y vincularlo al **mismo** `auth_user_id` de Supabase (mismo correo). Así el mismo correo corporativo queda “reasignado” al nuevo empleado.
  2. O simplemente dejar el correo inactivo y crear cuentas nuevas con otros correos para nuevos empleados.

Para poder “reasignar” el mismo correo a otro User en nuestra app, en el futuro se podría ofrecer en el panel del admin algo como: “Alta de recepcionista con correo existente” (elegir un correo ya registrado en Supabase que esté vinculado a un User dado de baja, y crear nuevo User con ese `auth_user_id`). Hoy eso sería manual o vía API si el backend lo permite.

---

## 3. Qué hacer a nivel del gym

- **Configurar dominio de correo** (ej. Google Workspace, Microsoft 365) para tener `@migym.com`.
- **Dar de alta al staff:** Crear cuenta en la app con correo corporativo (ej. `recep1@migym.com`). El Admin entrega usuario y contraseña en persona; no se envía bienvenida por correo al staff.
- **Política interna:** Comunicar que las cuentas son corporativas; al desvincular a alguien, el gym se queda con el correo. Si resetean contraseña de staff, la nueva llega al correo del Admin (no al staff).

---

## 4. Resumen

| Pregunta | Respuesta |
|----------|-----------|
| ¿La gestión de correos debería ser por gym? | **Sí.** Se recomienda usar correos corporativos del gym para staff. |
| ¿Por qué? | Al dar de baja a alguien, el correo sigue siendo del gym; pueden cambiar contraseña y reasignar el correo a otra persona o dejarlo inactivo. |
| ¿Dónde está el email hoy? | En Supabase Auth; nosotros solo guardamos `auth_user_id` en `User`. |
| ¿Algo que implementar? | Opcional: en el panel admin, flujo para “restablecer contraseña” (magic link) o “alta con correo existente” para reasignar un correo corporativo a un nuevo User. La política (usar @dominiodelgym) se aplica sobre todo por proceso y configuración del gym. |

---

## 5. Referencia técnica

- **Auth:** Supabase Auth (email + password). Backend solo valida JWT y resuelve `gym_id` y `role` desde `User` por `auth_user_id`.
- **Soft delete:** `User.deleted_at`; el middleware de auth excluye `deleted_at: null`, por lo que el usuario dado de baja ya no puede entrar aunque el email siga en Supabase.
- **Reasignar correo:** Mismo `auth_user_id` en un **nuevo** User (el anterior quedó con `deleted_at`). Requiere que el backend permita crear/actualizar User con un `auth_user_id` que ya existía en otro User dado de baja (o un flujo explícito de “reasignar”).
