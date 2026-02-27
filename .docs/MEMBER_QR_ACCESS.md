# QR de acceso del socio (único y estable)

El QR que identifica al socio es **único y estable**. Para el **personal (staff)**, ver **STAFF_QR_ACCESS_AND_ATTENDANCE.md**. Se envía por **WhatsApp** (n8n). El canal de email se reserva para bienvenida (credenciales) y recuperación de contraseña. Ver **CANALES_COMUNICACION.md**. Si borró el chat o lo perdió, se puede **reenviar** el mismo QR por WhatsApp. Admin/SuperAdmin puede **regenerar** un QR nuevo (invalida el anterior); el admin puede dar permiso `can_regenerate_member_qr` a staff para delegar (ej. cuando el admin no está). Ver QR de socios en la ficha del detalle requiere permiso `can_view_member_qr` (por defecto Admin/SuperAdmin); útil cuando un socio no lleva teléfono y recepción puede mostrar el QR en pantalla.

---

## 1. Formato del código

- **QR:** `GYM_QR_<qr_token>` (hex único). El `qr_token` se genera al dar de alta al socio y se envía por WhatsApp con el mensaje de bienvenida.
- **En app (MemberHome, MemberQR):** se usa `qr_payload` del perfil (`GET /members/me`).
- **En check-in (recepción):** el escáner lee el código y el backend acepta:
  - `userId` (UUID) en el body, o
  - `code` (string): `GYM_QR_<qr_token>` (único formato QR).

El backend resuelve `code` → `userId` por `qr_token` y hace el check-in con `accessMethod: QR` → se actualiza la racha y se registra la visita. **No hace falta que el socio abra la app.**

---

## 2. Flujo completo

1. **Alta del socio:** el backend (createUser) genera `qr_token`, crea el usuario y envía a n8n `event: 'welcome'` con `qrData: GYM_QR_<qr_token>`, PIN, etc. n8n envía el mensaje de bienvenida por WhatsApp. Cuando el gym tiene portal (`qr_access`), el **email es opcional**: si se indica, se crea cuenta en Supabase con contraseña temporal, se envía por correo (evento `member_welcome`) y en el primer inicio de sesión se pide cambio de contraseña; si no, el staff puede enviar acceso después desde la ficha del socio. Ver **ACCESO_PORTAL_SOCIOS.md**. Si el gym **sube de BASIC a plan con QR**, los socios que no tenían email/cuenta pueden recibir acceso desde la ficha del socio con el botón «Enviar acceso al portal» (ver **ACCESO_PORTAL_SOCIOS.md**).
2. **Socio recibe por WhatsApp** su QR. Ese mismo código es estable y no cambia.
3. **En el gym:** recepción escanea el QR de dos maneras: **(a)** Pistola USB/Bluetooth: el lector envía código + Enter → el input invisible captura y dispara check-in. **(b)** Cámara del dispositivo: botón "Usar cámara" → modal con cámara (PC, tablet o móvil) → al detectar QR, frontend `POST /checkin` con `{ code, accessMethod: 'QR' }` → backend registra llegada y actualiza racha.
4. **Reenviar el mismo QR** (borró el chat, lo perdió, etc.):
   - **Desde el socio:** en la app (MemberHome o MemberQR), botón "Recibir mi QR por WhatsApp" → `POST /members/me/send-qr` → backend llama a n8n con `event: 'resend_qr'` y el mismo `qrData`.
   - **Desde recepción/admin:** en la ficha del socio (Recepción → Socios → Editar socio), botón "Reenviar QR por WhatsApp" → `POST /users/:id/send-qr` → mismo flujo n8n.
5. **Regenerar QR** (Admin/SuperAdmin o staff con `can_regenerate_member_qr`):
   - En la ficha del socio (detalle o Editar socio), botón "Regenerar QR" → `POST /users/:id/regenerate-qr` con opcional `sendToWhatsApp: true`.
   - Genera nuevo `qr_token`, invalida el anterior. Si `sendToWhatsApp` y hay teléfono, se envía el nuevo código por WhatsApp.
   - El admin puede dar permiso `can_regenerate_member_qr` al staff en Personal → Permisos.
6. **Ver QR en detalle del socio** (Admin/SuperAdmin o staff con `can_view_member_qr`):
   - En la ficha del socio (Recepción o Admin Socios), si el usuario tiene permiso, se muestra la imagen del QR en el modal de detalle.
   - Útil cuando un socio no lleva teléfono: recepción abre la ficha, muestra el QR en pantalla y se escanea desde ahí. El admin puede dar permiso `can_view_member_qr` en Personal → Permisos.

---

## 3. n8n

- **Welcome:** el backend hace POST al webhook configurado (welcome) con `event: 'welcome'`, `phone`, `pin`, `qrData`.
- **Reenviar QR:** mismo webhook, con `event: 'resend_qr'`, `phone`, `qrData` (sin PIN). En n8n se puede bifurcar por `event`: si es `resend_qr`, enviar solo el mensaje con el QR (ej. "Tu código de acceso") sin texto de bienvenida.

---

## 4. Reglas

- **QR único y estable:** no rota por defecto. Es como la huella de acceso del socio.
- **Reenviar = mismo código:** "Recibir mi QR por WhatsApp" o "Reenviar QR" desde staff vuelven a enviar el mismo `GYM_QR_<qr_token>` por WhatsApp.
- **Regenerar = nuevo código:** Admin/SuperAdmin o staff con `can_regenerate_member_qr`. El anterior queda invalidado de inmediato.
- **Escaneo = llegada:** código válido + suscripción activa + horario/anti-passback OK → el sistema considera que llegó al gym y actualiza la racha sin abrir la web.
- **Anti-passback:** el mismo código no puede usarse de nuevo antes de 4 horas (backend).

---

## 5. Endpoints

| Endpoint | Método | Permiso | Descripción |
|----------|--------|---------|-------------|
| `POST /members/me/send-qr` | POST | Socio (portal) | Reenviar mi QR por WhatsApp |
| `POST /users/:id/send-qr` | POST | Staff | Reenviar QR del socio por WhatsApp |
| `POST /users/:id/send-portal-access` | POST | Staff | Enviar acceso al portal a un socio sin cuenta (ej. subida BASIC→QR). Body: `{ email: string }` |
| `POST /users/:id/regenerate-qr` | POST | Admin/SuperAdmin o `can_regenerate_member_qr` | Regenerar QR (invalida el anterior). Body opcional: `{ sendToWhatsApp: boolean }` |
| `GET /users/:id` (socio) | GET | Staff con `can_view_members` | Detalle del socio. Devuelve `qr_payload` solo si el usuario tiene `can_view_member_qr` o es Admin/SuperAdmin. |
