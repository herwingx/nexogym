# Canales de comunicación (Email vs WhatsApp)

Estrategia de canales: **Email** solo para bienvenida y recuperación de contraseña; **WhatsApp** para QR, cumpleaños y mensajes al socio.

> **Setup operativo:** Proveedores de correo para n8n, estrategia de dominios y checklist de configuración en **EMAIL_N8N_Y_DOMINIOS.md**.

---

## 1. Resumen por canal

| Canal | Uso | Ejemplos |
|-------|-----|----------|
| **Email** | Bienvenida (credenciales) y recuperación de contraseña | Admin creado, Member con email (portal), Member "olvidé contraseña", reset staff → correo del Admin |
| **WhatsApp** | QR de acceso, cumpleaños, recompensas, resumen de corte | Socio recibe QR, felicitación cumpleaños, premio por racha |

**Regla de oro:** No enviamos correo al staff. El Admin les da usuario y contraseña en persona; si se resetea, la nueva contraseña va al correo del Admin.

---

## 2. Email

### 2.1 Bienvenida (credenciales)

- **Admin del gym:** Al crear un gym desde `/saas` con email y contraseña del admin, se envía un correo de bienvenida con:
  - Usuario (email)
  - Contraseña temporal
  - Link de login
- **Webhook n8n:** `admin_welcome` (`/webhook/admin-bienvenida`)
- **Condición:** Requiere `APP_LOGIN_URL` en `.env` del backend.
- **Flujo:** Admin recibe el correo → primer login → modal obligatorio para cambiar contraseña.

- **Socio con email (portal/gamificación):** En el alta desde recepción, si se indica email opcional, el socio recibe:
  - QR por **WhatsApp** (teléfono)
  - Por **correo**: credenciales de portal (email + contraseña temporal) + QR y PIN como backup
- **Webhook n8n:** `member_welcome` (`/webhook/member-bienvenida`)
- **Condición:** Requiere `APP_LOGIN_URL` en `.env` del backend.

### 2.2 Comprobante por correo (renovación / soporte socios)

- **Cuándo:** Tras renovar la suscripción de un socio (cualquier plan: mensual, semanal, anual, etc.) desde Recepción o Admin.
- **A quién:** Al correo del socio, solo si tiene cuenta con email (alta con email o vinculado a Supabase Auth).
- **Payload n8n:** `event: 'member_receipt'`, URL por defecto `/webhook/comprobante-socio`. Campos: `gym_id`, `gym_name`, `member_email`, `member_name`, `plan_barcode`, `plan_label` (ej. "Mensual", "Anual"), `amount`, `expires_at` (ISO), `renewed_at` (ISO). Opcional `is_visit_one_day` para futuras ventas de visita 1 día.
- **Objetivo:** El socio recibe comprobante de la renovación (plan, monto, vigencia) para soporte y trazabilidad.
- **Configuración gym:** En `n8n_config.enabled_events` se puede excluir `member_receipt` si el gym no quiere enviar comprobantes; por defecto está habilitado si el webhook existe.
- **Folio:** Cada comprobante de renovación incluye `receipt_folio` (ej. R-2025-000042) para auditoría del admin.

### 2.3 Comprobante de venta POS

- **Cuándo:** En cada venta en POS la recepción puede indicar un correo opcional ("Enviar comprobante a"). Si se indica, el backend envía a n8n el detalle de la venta para que se envíe el comprobante por correo (PDF o cuerpo del correo).
- **A quién:** Al correo indicado en caja; no hace falta que el cliente esté registrado.
- **Payload n8n:** `event: 'sale_receipt'`, URL por defecto `/webhook/comprobante-venta`. Campos: `gym_id`, `gym_name`, `customer_email`, `receipt_folio` (V-YYYY-NNNNNN), `sale_id`, `items` (product_name, quantity, unit_price, line_total), `total`, `sold_at` (ISO).
- **Folio:** Cada venta tiene un folio único por gym y año (V-2025-000001) guardado en `Sale.receipt_folio` para auditoría.

### 2.4 Recuperación de contraseña

- **Members (socios con login):** Usan "¿Olvidaste tu contraseña?" en la pantalla de login. Supabase envía el enlace de recuperación por correo (requiere SMTP configurado en Supabase).
- **Staff (Recep, Coach, Instructor):** No usan "olvidé contraseña". El **Admin** resetea la contraseña desde Personal (`/admin/staff`) → "Resetear contraseña". La **nueva contraseña se envía al correo del Admin**, quien la entrega al staff en persona.
- **Webhook n8n:** `staff_password_reset` (`/webhook/staff-password-reset`)

---

## 3. WhatsApp

### 3.1 QR de acceso (socios)

- **Alta del socio:** El backend envía a n8n `event: 'welcome'` con `qrData`, `pin`, `phone`. n8n envía el mensaje por WhatsApp con el QR y PIN.
- **Reenviar QR:** `event: 'resend_qr'` — mismo código, solo texto "Tu código de acceso".
- **Regenerar QR:** Solo Admin, invalida el anterior. Opcionalmente envía el nuevo por WhatsApp.
- **Webhook n8n:** `welcome` (`/webhook/nuevo-cliente`)

### 3.2 Cumpleaños

- **Flujo:** n8n llama a `GET /api/v1/integrations/birthdays?date=YYYY-MM-DD` (cron diario). Obtiene socios con `birth_date` ese día. n8n envía felicitación por WhatsApp.
- **Dato:** `User.birth_date` (opcional al alta).

### 3.3 Recompensas (gamificación)

- **Evento:** Socio alcanza racha o premio. Backend envía `event: 'reward'` a n8n. n8n envía mensaje por WhatsApp.
- **Webhook n8n:** `reward` (`/webhook/recompensa`)

### 3.4 Resumen de corte de caja

- **Evento:** Corte de caja cerrado. Backend envía `event: 'shift_summary'` al teléfono del dueño.
- **Webhook n8n:** `shift_summary` (`/webhook/corte-caja`)

### 3.5 Bienvenida staff

- **Evento:** Admin crea staff con teléfono. Backend envía `event: 'staff_welcome'` con `phone`, `qrData`, `gym_name`, `staff_name`. n8n envía mensaje de bienvenida por WhatsApp: "Gracias por unirte al equipo de [gym]" + QR de acceso.
- **Webhook n8n:** Usa el mismo webhook `welcome` (`/webhook/nuevo-cliente`); n8n bifurca por `event`. Opcional: `/webhook/staff-bienvenida` para workflow separado. Ver **STAFF_QR_ACCESS_AND_ATTENDANCE.md**.

---

## 4. Administración de contraseñas por rol

| Rol | Quién administra | Cómo se resetea |
|-----|------------------|-----------------|
| **SuperAdmin** | Solo él mismo | "Olvidé contraseña" por correo (Supabase) |
| **Admin (gym)** | SuperAdmin o él mismo | "Olvidé contraseña" por correo. Bienvenida por email al crearse. |
| **Staff** (Recep, Coach, Instructor) | **Admin** | Admin usa "Resetear contraseña" en Personal → nueva contraseña va al correo del Admin → Admin la entrega al staff en persona |
| **Members** (socios con login) | **Ellos mismos** o Admin | "Olvidé contraseña" por correo (self-service) |

---

## 5. Staff: credenciales, QR y bienvenida por WhatsApp

El staff (Recep, Coach, Instructor) son personal que rota. **No usamos correo personal ni corporativo**:

- **Creación:** Admin → Personal → "Agregar personal" → indica nombre, teléfono, rol, contraseña (opcional). El sistema genera un **email interno** basado en el nombre del gym: `{gym-slug}-staff-{id}@internal.nexogym.com`. No requiere correo corporativo.
- El Admin recibe **usuario y contraseña** y los entrega en persona al staff.
- **Bienvenida por WhatsApp:** Al crear staff con teléfono, se envía un mensaje de bienvenida por WhatsApp al teléfono del staff: "Gracias por unirte al equipo de [gym]." + QR de acceso. Ver **STAFF_QR_ACCESS_AND_ATTENDANCE.md**.
- Si olvidan contraseña: Admin → Personal → "Resetear contraseña" → la **nueva contraseña llega al correo del Admin** → él se la entrega al staff en persona.
- **Ventaja:** No depende de que el staff o el gym tengan correo; el Admin controla todo el flujo. Al desvincular a alguien, el gym no pierde nada.

---

## 6. Supabase SMTP vs n8n

| Quién envía | Qué |
|-------------|-----|
| **Supabase** (SMTP en Dashboard) | Solo "olvidé contraseña" en el login. No hay API para otros correos. |
| **n8n** (con Resend, SendGrid, etc.) | Bienvenidas, comprobantes, reset staff, y todos los demás emails transaccionales. |

Ver **EMAIL_N8N_Y_DOMINIOS.md** para proveedores recomendados, dominio y checklist.

---

## 7. Variables de entorno

| Variable | Uso |
|----------|-----|
| `APP_LOGIN_URL` | URL base del frontend para enlaces de login (ej. `https://app.nexogym.com`). Si está vacía, no se envía bienvenida por email (admin ni socio con portal). |
| `N8N_BASE_URL` | URL base de n8n para webhooks. |
| `SUPABASE_*` | Supabase maneja "olvidé contraseña" por email (SMTP configurado en Supabase). |

---

## 8. Webhooks n8n

| Webhook | Evento | Canal | Payload principal |
|---------|--------|-------|-------------------|
| `/webhook/nuevo-cliente` | `welcome`, `resend_qr` | WhatsApp | phone, qrData, pin |
| `/webhook/staff-bienvenida` o `welcome` | `staff_welcome` | WhatsApp | phone, qrData, gym_name, staff_name |
| `/webhook/admin-bienvenida` | `admin_welcome` | Email | admin_email, admin_name, temp_password, login_url |
| `/webhook/member-bienvenida` | `member_welcome` | Email | member_email, member_name, temp_password, login_url, qr_data, pin |
| `/webhook/staff-password-reset` | `staff_password_reset` | Email | admin_email (to), staff_name, staff_email, new_password |
| `/webhook/recompensa` | `reward` | WhatsApp | phone, rewardName, streak |
| `/webhook/corte-caja` | `shift_summary` | WhatsApp | phone, summary |

Los webhooks de **email** (admin_welcome, member_welcome, staff_password_reset) deben configurarse en n8n para enviar correo (Gmail, SendGrid, Resend, etc.). Los de **WhatsApp** usan la integración de WhatsApp Business de n8n.
