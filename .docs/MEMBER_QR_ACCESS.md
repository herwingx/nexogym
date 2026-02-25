# QR de acceso del socio (único y estable)

El QR que identifica al socio es **único y estable**. Se envía por WhatsApp (n8n) y evita tener que mandar un QR nuevo a cada rato; ese código es como su "huella" de acceso. Si borró el chat o lo perdió, se puede **reenviar** el mismo QR por WhatsApp. Solo Admin puede **regenerar** un QR nuevo (invalida el anterior), por ejemplo si hubo fraude o cambio de teléfono.

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

1. **Alta del socio:** el backend (createUser) genera `qr_token`, crea el usuario y envía a n8n `event: 'welcome'` con `qrData: GYM_QR_<qr_token>`, PIN, etc. n8n envía el mensaje de bienvenida por WhatsApp.
2. **Socio recibe por WhatsApp** su QR. Ese mismo código es estable y no cambia.
3. **En el gym:** recepción escanea el QR → lector envía código + Enter → frontend `POST /checkin` con `{ code, accessMethod: 'QR' }` → backend registra llegada y actualiza racha.
4. **Reenviar el mismo QR** (borró el chat, lo perdió, etc.):
   - **Desde el socio:** en la app (MemberHome o MemberQR), botón "Recibir mi QR por WhatsApp" → `POST /members/me/send-qr` → backend llama a n8n con `event: 'resend_qr'` y el mismo `qrData`.
   - **Desde recepción/admin:** en la ficha del socio (Recepción → Socios → Editar socio), botón "Reenviar QR por WhatsApp" → `POST /users/:id/send-qr` → mismo flujo n8n.
5. **Regenerar QR** (solo Admin):
   - En la ficha del socio (Editar socio), botón "Regenerar QR" → `POST /users/:id/regenerate-qr` con opcional `sendToWhatsApp: true`.
   - Genera nuevo `qr_token`, invalida el anterior. Si `sendToWhatsApp` y hay teléfono, se envía el nuevo código por WhatsApp.

---

## 3. n8n

- **Welcome:** el backend hace POST al webhook configurado (welcome) con `event: 'welcome'`, `phone`, `pin`, `qrData`.
- **Reenviar QR:** mismo webhook, con `event: 'resend_qr'`, `phone`, `qrData` (sin PIN). En n8n se puede bifurcar por `event`: si es `resend_qr`, enviar solo el mensaje con el QR (ej. "Tu código de acceso") sin texto de bienvenida.

---

## 4. Reglas

- **QR único y estable:** no rota por defecto. Es como la huella de acceso del socio.
- **Reenviar = mismo código:** "Recibir mi QR por WhatsApp" o "Reenviar QR" desde staff vuelven a enviar el mismo `GYM_QR_<qr_token>` por WhatsApp.
- **Regenerar = nuevo código:** solo Admin/SuperAdmin puede regenerar. El anterior queda invalidado de inmediato.
- **Escaneo = llegada:** código válido + suscripción activa + horario/anti-passback OK → el sistema considera que llegó al gym y actualiza la racha sin abrir la web.
- **Anti-passback:** el mismo código no puede usarse de nuevo antes de 4 horas (backend).

---

## 5. Endpoints

| Endpoint | Método | Permiso | Descripción |
|----------|--------|---------|-------------|
| `POST /members/me/send-qr` | POST | Socio (portal) | Reenviar mi QR por WhatsApp |
| `POST /users/:id/send-qr` | POST | Staff | Reenviar QR del socio por WhatsApp |
| `POST /users/:id/regenerate-qr` | POST | Admin/SuperAdmin | Regenerar QR (invalida el anterior). Body opcional: `{ sendToWhatsApp: boolean }` |
