# Acceso QR y checada de turno del personal (staff)

Documentación del flujo de acceso y registro de asistencia del staff (Recepcionista, Coach, Instructor, Limpieza): creación con QR, bienvenida por WhatsApp, baja/reactivación, vista detalle y checada de turno.

> **Estado:** Implementado. Al crear staff se genera QR, se envía bienvenida por WhatsApp (si hay teléfono), el admin puede ver el QR en el detalle, reenviar o regenerar, y el staff puede checar su entrada escaneando su QR.

---

## 1. Flujo al crear staff (objetivo)

Cuando el Admin crea un miembro del personal:

1. **Se genera acceso** (igual que socios): `qr_token` único para QR, credenciales de login (email interno + contraseña).
2. **Admin ve el QR** en la ficha del staff (modal de detalle) para poder mostrarlo o imprimirlo si hace falta.
3. **Se envía WhatsApp de bienvenida** al teléfono del staff con mensaje tipo: «Gracias por unirte al equipo de [nombre del gym]. Aquí tienes tu código de acceso.» + QR. Los mensajes e imágenes se afinarán después; n8n permite personalizar plantillas.

**Diferencia con socios:** El staff recibe bienvenida por **WhatsApp** (no por correo). El Admin sigue recibiendo credenciales en persona si lo prefiere; el QR en WhatsApp es complementario.

**Roles de staff:** Recepcionista, Coach, Instructor, **Limpieza**. El personal de limpieza también recibe QR y checada; aparece en auditoría. Ver **STAFF_PERMISSIONS_BY_ADMIN.md**.

---

## 2. Baja de staff — invalidación de acceso

**Comportamiento actual (ya implementado):**

- **Dar de baja** = soft delete: `deleted_at = now()`.
- El middleware de auth excluye usuarios con `deleted_at != null` → **no puede iniciar sesión**.
- Si el staff tuviera QR, el check-in debe rechazarlo (validar `deleted_at` al resolver el token).

**Al dar de baja se invalida TODO el acceso:**

| Qué se invalida | Cómo |
|-----------------|------|
| Login | Auth middleware ignora usuarios con `deleted_at`. |
| QR (cuando exista) | Check-in rechaza si el usuario está dado de baja. |
| App / portal | No puede acceder si no puede loguearse. |

**Al reactivar** (`restoreUser` → `deleted_at = null`):

- Vuelve a poder loguearse.
- **QR:** El mismo token sigue en la BD (no se borra al dar de baja). Opciones:
  - **A)** Mantener el mismo QR: funciona de nuevo al reactivar. Simple.
  - **B)** Regenerar QR al reactivar: más seguro si hubo riesgo de fraude o fuga. Requiere lógica extra.

**Recomendación:** Empezar con (A). Si el gym lo necesita, se puede añadir «Regenerar QR» al reactivar, igual que en socios.

**Reenviar QR:** Igual que socios. Si el staff perdió el mensaje de WhatsApp, el Admin puede «Reenviar QR por WhatsApp» desde la ficha del staff.

---

## 3. Vista detalle del staff (como la de socios)

`MemberDetailModal` (socios) y `StaffDetailModal` (personal) comparten el layout `UserDetailLayout` (`components/detail/UserDetailLayout.tsx`): header compacto (foto + nombre + badge), grid de metadatos en 2 columnas, secciones de visitas y QR, y barra de acciones. Cada modal aporta sus propios metadatos y acciones; la estructura visual es reutilizada.

### 3.1 Metadatos a mostrar

| Campo | Descripción |
|-------|-------------|
| Foto de perfil | `profile_picture_url` o placeholder |
| Nombre | `name` |
| Teléfono | `phone` |
| Rol | Recepcionista, Coach, Instructor |
| Estado | Activo / Inactivo (badge) |
| Fecha de alta | `created_at` |
| Acceso al portal | Sí/No (si tiene `auth_user_id`) |
| Credenciales (usuario) | Email interno para login (modal o sección) |
| Permisos | Resumen o link a editar permisos |
| **Últimas checadas** | Si se implementa check-in de staff (ver sección 5) |
| **QR** | Ver QR, Reenviar por WhatsApp, Regenerar (solo Admin) |

**No mostrar (específico de socios):** Suscripción, plan, vencimiento, racha, cumpleaños.

### 3.2 Acciones en la ficha

- Ver credenciales (usuario / email)
- Ver QR / Reenviar QR / Regenerar QR (Admin)
- Editar permisos
- Resetear contraseña
- Dar de baja / Reactivar (Admin)

---

## 4. Checada de turno del staff — flujo sin tecnicismos

### 4.1 ¿Quién hace la checada?

Hay dos formas de registrar la entrada del staff:

| Escenario | Descripción | Quién hace la checada |
|-----------|-------------|------------------------|
| **A) Recepcionista escanea** | El staff llega a recepción y muestra su QR (teléfono o impreso). El recepcionista escanea con la pistola USB o la cámara del Check-in (igual que con socios). | **Recepcionista** (o quien esté en turno en recepción). |
| **B) Staff escanea solo** | Hay un lector/torniquete en la puerta. El staff escanea su propio QR. El lector envía el código a la API y el sistema registra la entrada. | **Nadie manual** — el sistema registra solo al validar el QR. |

En ambos casos el **sistema** hace lo mismo: recibe un código QR, valida que sea de un usuario del gym, que no esté dado de baja y que sea staff (o socio con suscripción activa). Para staff se omite la validación de suscripción. Se registra la visita (tabla `Visit`).

### 4.2 ¿El recepcionista «hace» la checada al staff?

- **En escenario A:** Sí. El recepcionista escanea el QR del staff como si fuera un socio. Es el mismo flujo de Check-in. La única diferencia es que, para staff, no se valida suscripción.
- **En escenario B:** No. El staff se registra solo al pasar su QR por el lector. El recepcionista no interviene.

**Conclusión:** La lógica es la misma; solo cambia quién escanea: recepcionista (A) o el propio staff en el lector (B).

### 4.3 Auditoría — ¿se ve la checada del staff?

Sí. Las visitas se guardan en `Visit` con `user_id`. Como el staff es un `User` del gym, sus checadas aparecen igual que las de socios.

En la pantalla de **Auditoría** se pueden filtrar acciones por tipo. Si se añade un filtro «Visitas» o «Check-ins», se verán tanto socios como staff. Para distinguirlos: el `User.role` indica si es MEMBER (socio) o staff (RECEPTIONIST, COACH, INSTRUCTOR).

---

## 5. Implementación técnica (resumen)

### 5.1 Check-in de staff

- `POST /checkin`: si el usuario es staff (role ≠ MEMBER), se salta la validación de suscripción y se registra la visita.
- Se valida `deleted_at` al resolver el código QR: usuarios dados de baja no pueden checar.
- Anti-passback 2h aplica igual; racha y premios no aplican a staff.

### 5.2 Creación de staff con QR

- En `createStaff`: se genera `qr_token` y se guarda en BD.
- Si hay teléfono, se llama a n8n `sendStaffWelcomeMessage` con `event: 'staff_welcome'` (usa webhook welcome; n8n bifurca por event).
- Ver sección 6 para webhook y payload.

### 5.3 Endpoints

| Endpoint | Uso para staff |
|----------|----------------|
| `GET /users/:id/staff-detail` | Detalle del staff (QR, visitas, permisos) |
| `POST /users/:id/send-qr` | Reenviar QR por WhatsApp |
| `POST /users/:id/regenerate-qr` | Regenerar QR (solo Admin) |

---

## 6. n8n — webhook y mensajes

### 6.1 Evento staff_welcome

| Campo | Descripción |
|-------|-------------|
| `event` | `staff_welcome` |
| `phone` | Teléfono del staff |
| `qrData` | `GYM_QR_<qr_token>` |
| `gym_name` | Nombre del gym |
| `staff_name` | Nombre del staff |

**Webhook n8n sugerido:** `/webhook/staff-bienvenida` (crear workflow en n8n).

**Mensaje de ejemplo (a afinar):**

> ¡Hola {staff_name}! Gracias por unirte al equipo de {gym_name}. Aquí tienes tu código de acceso al gimnasio. Guárdalo en tu teléfono para registrar tu entrada cuando llegues.

**Imágenes:** Se pueden añadir plantillas con imagen del gym o logo en n8n. Documentar en **EMAIL_N8N_Y_DOMINIOS.md** o en un doc de plantillas cuando se definan.

### 6.2 Refinamiento posterior

- Mensajes: tono, longitud, emojis.
- Imágenes: logo del gym, ilustración de bienvenida.
- Diseño de correos (si en el futuro se envía también email al staff).
- Variables dinámicas: nombre del gym, del staff, etc.

---

## 7. Referencias

| Documento | Contenido |
|-----------|-----------|
| **MEMBER_QR_ACCESS.md** | QR de socios (formato, reenviar, regenerar). |
| **CANALES_COMUNICACION.md** | Email vs WhatsApp, flujo staff (credenciales, reset). |
| **EMAIL_N8N_Y_DOMINIOS.md** | Setup de n8n, proveedores, dominios. |
| **STAFF_PERMISSIONS_BY_ADMIN.md** | Permisos del staff y quién puede dar de baja. |
