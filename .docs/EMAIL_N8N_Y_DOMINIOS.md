# Email, n8n y estrategia de dominios

Documento de referencia para el setup operativo de correo: quién envía qué, proveedores recomendados, estrategia de dominios y roadmap de marketing.

---

## 1. División de responsabilidades: Supabase vs n8n

### Supabase SMTP — Solo recuperación de contraseña

| Qué | Cómo |
|-----|------|
| **"Olvidé mi contraseña"** (login) | El usuario hace clic en el enlace → Supabase Auth envía el email con el link de reset. Usa el SMTP configurado en el proyecto Supabase (Dashboard → Auth → SMTP). |

**Importante:** Supabase no ofrece un API genérico para enviar correos. Solo envía los emails que dispara Auth internamente (confirmación de registro, magic link, reset password). No se puede usar Supabase para bienvenidas, comprobantes, etc.

### n8n + proveedor de email — Todo lo demás

| Flujo | Canal | Webhook n8n |
|-------|-------|-------------|
| Bienvenida admin (crear gym) | Email | `admin_welcome` |
| Bienvenida socio (portal) | Email | `member_welcome` |
| Reset contraseña staff → Admin | Email | `staff_password_reset` |
| Comprobante renovación | Email | `member_receipt` |
| Comprobante venta POS | Email | `sale_receipt` |
| QR, recompensas, corte, cumpleaños | WhatsApp | varios |
| Bienvenida staff (planificado) | WhatsApp | `staff_welcome` (ver STAFF_QR_ACCESS_AND_ATTENDANCE.md) |

Los webhooks de email de n8n requieren un **proveedor de correo** (Resend, SendGrid, Gmail, Brevo, etc.) configurado en n8n. Ver sección 2.

**Referencia detallada:** Ver **CANALES_COMUNICACION.md** para payloads, eventos y webhooks.

---

## 2. Proveedor de correo para n8n

Elegir **un solo proveedor** e integrarlo en n8n. Opciones recomendadas:

| Proveedor | Integración n8n | Pros | Contras |
|-----------|-----------------|------|---------|
| **Resend** | Nodo oficial | API simple, buen deliverability, planes gratuitos | — |
| **SendGrid** | Nodo nativo | Muy usado, plantillas, analytics | Más complejo |
| **Brevo** (Sendinblue) | Sí | Incluye CRM, plan gratuito generoso | — |
| **Gmail / SMTP genérico** | Sí | Gratis si usas tu Gmail | Límites de envío, menos profesional |

**Setup:** Crear cuenta en el proveedor, obtener API key, configurar el nodo en los workflows de n8n que envían email (admin_welcome, member_welcome, staff_password_reset, member_receipt, sale_receipt).

---

## 3. Estrategia de dominios para el envío

### Recomendación: Un dominio (NexoGym)

| Opción | Descripción | Pros | Contras |
|--------|-------------|------|---------|
| **Un dominio** (`nexogym.com`) | Todos los correos salen de `noreply@nexogym.com` (o similar). El **From name** = nombre del gym. | Una sola configuración SPF/DKIM/DMARC; simple de mantener. | El email técnico es de la plataforma (habitual en SaaS). |
| **Dominio por gym** | Cada gym envía desde `hola@fitzone.com`, `newsletter@elitebody.com`. | El correo "viene" del dominio del gym. | Requiere que cada gym configure DNS (SPF, DKIM); más complejo; viable como feature enterprise. |

**Práctica estándar:** Usar el dominio de la plataforma (`noreply@nexogym.com`, `notificaciones@nexogym.com`) y personalizar el **From name** con el nombre del gym. Ejemplo: `From: FitZone <noreply@nexogym.com>` — el usuario ve "FitZone" en su bandeja.

**Configuración necesaria:** SPF, DKIM y DMARC en el dominio `nexogym.com` (o el dominio que uses). El proveedor (Resend, SendGrid, etc.) indica qué registros DNS añadir.

---

## 4. Marketing por email para admins (roadmap)

**Objetivo:** Permitir a los admins enviar newsletters, promos o comunicaciones a los socios de su gym.

| Aspecto | Notas |
|---------|-------|
| **Lista** | Socios del gym con email; opt-in para marketing (campo `marketing_opt_in` o similar). |
| **Templates** | En n8n o editor simple en la app. |
| **Envío** | Nuevo webhook n8n, ej. `event: 'gym_marketing'`, con `gym_id`, destinatarios, asunto, cuerpo. |
| **Dominio** | Mismo dominio Nexo; From name = nombre del gym. |
| **Proveedor** | El mismo Resend/SendGrid que usa n8n para transaccionales. |

La arquitectura actual (n8n + un proveedor + dominio Nexo) soporta este flujo sin cambios de infra. Solo hace falta el webhook, el workflow en n8n y la UI en el panel admin.

---

## 5. Checklist de setup

- [ ] **Supabase:** Configurar SMTP en Dashboard → Auth → SMTP (solo para "olvidé contraseña").
- [ ] **Proveedor de correo:** Crear cuenta (Resend, SendGrid o Brevo) y obtener API key.
- [ ] **n8n:** Configurar el nodo del proveedor en los workflows de email.
- [ ] **Dominio Nexo:** Configurar SPF, DKIM y DMARC para el dominio de envío.
- [ ] **From name:** Usar `gym_name` del payload en los workflows de n8n para personalizar el remitente.

---

## 6. Referencias cruzadas

| Documento | Contenido relacionado |
|-----------|------------------------|
| **CANALES_COMUNICACION.md** | Eventos, webhooks, payloads y flujos por canal. |
| **DEV_WORKFLOW.md** | Variables de entorno (`N8N_BASE_URL`, `APP_LOGIN_URL`). |
| **ACCESO_PORTAL_SOCIOS.md** | Flujo de bienvenida por email al socio con portal. |
