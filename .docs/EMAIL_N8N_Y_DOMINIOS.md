# Email, Brevo y estrategia de dominios

Documento de referencia para el setup operativo de correo: quién envía qué, proveedores (Brevo integrado), estrategia de dominios y roadmap de marketing.

---

## 1. División de responsabilidades

### Supabase Auth — Solo recuperación de contraseña

| Qué | Cómo |
|-----|------|
| **"Olvidé mi contraseña"** (login) | El usuario hace clic en el enlace → Supabase Auth envía el email con el link de reset. Usa el SMTP configurado en el proyecto Supabase. |

**Importante:**
- Supabase **no incluye** servicio de correo. Requiere SMTP externo (Brevo) configurado en Auth.
- Las variables en el `.env` de Supabase Auth son `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER_NAME`, `SMTP_ADMIN_EMAIL` (sin prefijo GOTRUE_).
- Supabase solo envía los emails que dispara Auth (confirmación, magic link, reset password). No hay API para bienvenidas, comprobantes, etc.

### Brevo (backend directo) — Emails transaccionales

| Flujo | Canal | Servicio |
|-------|-------|----------|
| Bienvenida admin (crear gym) | Email | `email.service.sendAdminWelcomeEmail` |
| Bienvenida socio (portal) | Email | `email.service.sendMemberWelcomeEmail` |
| Reset contraseña staff → Admin | Email | `email.service.sendStaffPasswordResetToAdmin` |
| Comprobante renovación | Email | `email.service.sendMemberReceiptEmail` |
| Comprobante venta POS | Email | `email.service.sendSaleReceiptEmail` |

El backend envía directamente a Brevo API. No usa n8n para emails.

### n8n — Solo WhatsApp

| Flujo | Canal | Webhook n8n |
|-------|-------|-------------|
| QR, bienvenida socio | WhatsApp | `welcome` |
| Bienvenida staff | WhatsApp | `staff_welcome` |
| Recompensas | WhatsApp | `reward` |
| Corte de caja | WhatsApp | `shift_summary` |

**Referencia detallada:** Ver **CANALES_COMUNICACION.md** para payloads y flujos.

---

## 2. Proveedor de correo: Brevo vs Resend

### Comparación principal

| Aspecto | Brevo | Resend |
|---------|-------|--------|
| **Plan gratuito** | ~300/día (~9.000/mes) | ~3.000/mes |
| **Branding en correos** | Sí ("Sent with Brevo") en Free y Starter | No, correos limpios |
| **Enfoque** | Marketing + transaccionales + CRM | Solo transaccionales (dev-focused) |
| **Dominio propio** | Sí (noreply@nexogym.com) | Sí |
| **CRM** | Sí (contactos, bandeja) | No |
| **Promocionales** | Sí | No |
| **SMTP para Supabase Auth** | Sí | Sí |

### Cuándo elegir cada uno

- **Brevo:** Más margen gratis, CRM incluido, promos. Ideal para producción sin presupuesto inicial.
- **Resend:** API limpia, sin branding, mejor DX. Ideal si priorizas imagen profesional o desarrollo; límite free menor.

### Importante: todos los correos cuentan

Los correos de **Supabase Auth** (recuperación de contraseña) también usan el SMTP configurado (Brevo o Resend), por lo que **suman al límite del proveedor**. El volumen es bajo (~1–2% usuarios/mes).

---

## 2.1 Nota sobre alternativas

El proyecto usa **Brevo** integrado en el backend. Si en el futuro se migrara a Resend u otro proveedor, habría que adaptar `backend/src/services/email.service.ts`.

---

## 2.2 Estimación de volumen (escalamiento)

| Tipo de email | Frecuencia estimada | Vol/mes (30 gyms, ~9k users) |
|---------------|---------------------|------------------------------|
| **sale_receipt** (comprobante POS) | Cada venta con email opcional | **15.000 – 40.000** |
| **member_receipt** (comprobante renovación) | Por renovación de socio con email | 4.000 – 7.000 |
| Recuperación contraseña (Supabase Auth) | ~1–2% usuarios/mes | 90 – 180 |
| Member welcome | Nuevos socios con email | 100 – 300 |
| Admin welcome, staff reset | Bajo | 20 – 100 |

**Comprobante POS** es el que más volumen genera. Con 30 gyms, el total puede superar 20.000 emails/mes. Brevo free (9k) no alcanza; plan de pago (Brevo Starter ~$25 o Resend Pro $20) necesario al escalar.

---

## 2.3 CRM y soporte (landing, leads, tickets)

### Opción A: Brevo como todo-en-uno

Brevo incluye CRM, bandeja de conversaciones y formularios. Permite:
- Capturar leads desde la landing
- Responder desde Brevo (support@nexogym.com con dominio configurado)
- Historial por contacto

**Limitación:** Respuestas de soporte con diseño básico (firma personalizable, plantillas simples).

### Opción B: Herramientas dedicadas

| Función | Herramienta | Coste |
|---------|-------------|-------|
| Formulario → correo | Formspree, Getform | Gratis |
| Soporte / tickets | Freshdesk, Crisp | Gratis (plan básico) |
| CRM | HubSpot | Gratis (CRM básico) |

**Recomendación:** Empezar con Brevo (transaccionales + CRM + soporte básico). Si el volumen de tickets crece, añadir Freshdesk o Crisp.

---

## 2.4 Stack recomendado a futuro

| Necesidad | Herramienta sugerida |
|-----------|----------------------|
| Transaccionales | Brevo o Resend |
| Promocionales | Brevo |
| CRM | Brevo |
| Soporte (tickets) | Brevo Conversations o Freshdesk |
| Dominio (noreply@nexogym.com) | Configurar en el proveedor (SPF, DKIM, DMARC) |

**Mínimo viable:** Solo Brevo (cubre todo). **Alternativa:** Resend (transaccionales) + Brevo (promo, CRM, soporte).

---

## 3. Estrategia de dominios para el envío

### Recomendación: Un dominio (NexoGym)

| Opción | Descripción | Pros | Contras |
|--------|-------------|------|---------|
| **Un dominio** (`nexogym.com`) | Todos los correos salen de `noreply@nexogym.com` (o similar). El **From name** = nombre del gym. | Una sola configuración SPF/DKIM/DMARC; simple de mantener. | El email técnico es de la plataforma (habitual en SaaS). |
| **Dominio por gym** | Cada gym envía desde `hola@fitzone.com`, `newsletter@elitebody.com`. | El correo "viene" del dominio del gym. | Requiere que cada gym configure DNS (SPF, DKIM); más complejo; viable como feature enterprise. |

**Práctica estándar:** Usar el dominio de la plataforma (`noreply@nexogym.com`, `notificaciones@nexogym.com`) y personalizar el **From name** con el nombre del gym. Ejemplo: `From: FitZone <noreply@nexogym.com>` — el usuario ve "FitZone" en su bandeja.

**Configuración necesaria:** SPF, DKIM y DMARC en el dominio `nexogym.com`. El proveedor (Brevo, Resend, etc.) indica qué registros DNS añadir. Si usas Cloudflare para DNS, añades esos registros ahí.

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

## 5. Integración Brevo (implementada)

El backend usa **Brevo** directamente para correos transaccionales.

### Variables de entorno (`backend/.env`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `BREVO_API_KEY` | API key desde app.brevo.com → SMTP & API → Claves API | `xkeysib-xxxx` |
| `BREVO_FROM_EMAIL` | Remitente **verificado** en Brevo | `noreply@nexogym.com` o `tuemail@gmail.com` (pruebas) |
| `BREVO_FROM_NAME` | Nombre del remitente | `NexoGym` |
| `APP_LOGIN_URL` | URL base del frontend (enlaces en bienvenidas) | `https://app.nexogym.com` |

Si `BREVO_API_KEY` está vacío, los correos no se envían (no-op, sin error).

### Setup rápido (pruebas sin dominio)

1. Crear cuenta en [app.brevo.com](https://app.brevo.com)
2. **SMTP & API** → **Claves API** → Crear clave → copiar
3. **Configuración** → **Remitentes** → Añadir remitente → usar tu Gmail → verificar (click en el enlace que llega al correo)
4. En `backend/.env`:
   ```
   BREVO_API_KEY="xkeysib-tu-clave"
   BREVO_FROM_EMAIL="tuemail@gmail.com"
   BREVO_FROM_NAME="NexoGym"
   APP_LOGIN_URL="http://localhost:5173"
   ```
5. Reiniciar el backend

### Producción (con dominio)

1. En Brevo: **Dominios** → Añadir `nexogym.com` → configurar registros DNS (SPF, DKIM, DMARC)
2. Cambiar `BREVO_FROM_EMAIL` a `noreply@nexogym.com`

---

## 6. Checklist de setup

- [ ] **Brevo:** Crear cuenta en app.brevo.com.
  - **API key** (SMTP & API → Claves API) para el backend.
  - **SMTP key** (SMTP & API → SMTP / app.brevo.com/settings/keys/smtp) para Supabase Auth — no usar la API key como contraseña SMTP.
- [ ] **Backend:** Configurar `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` en `backend/.env`.
- [ ] **Supabase Auth:** Configurar SMTP de Brevo para "olvidé contraseña".
  - Hosted: Dashboard → Auth → SMTP (credenciales SMTP de Brevo).
  - Self-hosted: Variables `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER` (email Brevo), `SMTP_PASS` (clave SMTP, no API key), `SMTP_SENDER_NAME`, `SMTP_ADMIN_EMAIL` en el `.env` de Supabase Auth.
  - Aplicar cambios: `docker compose up -d auth --force-recreate`.
- [ ] **URL de redirect:** Añadir URL de login (ej. `https://app.nexogym.com/login`) en `additional_redirect_urls` de Supabase Auth.
- [ ] **Dominio Nexo:** En Brevo, añadir dominio y configurar SPF, DKIM, DMARC (registros DNS).

---

## 7. Referencias cruzadas

| Documento | Contenido relacionado |
|-----------|------------------------|
| **CANALES_COMUNICACION.md** | Eventos, webhooks, payloads y flujos por canal. |
| **DEV_WORKFLOW.md** | Variables de entorno (`N8N_BASE_URL`, `APP_LOGIN_URL`). |
| **ACCESO_PORTAL_SOCIOS.md** | Flujo de bienvenida por email al socio con portal. |
