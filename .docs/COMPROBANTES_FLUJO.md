# Flujo de comprobantes (POS y renovación) — diseño y recomendaciones

Objetivo: comprobante robusto para auditoría del admin, envío por correo (y opcional por WhatsApp) sin fricción, cubriendo ventas POS y renovaciones.

---

## 1. ¿Correo obligatorio en el alta del socio?

**Recomendación: NO obligar el correo.**

| Razón | Detalle |
|-------|--------|
| Fricción | Muchos socios solo dan teléfono; exigir email reduce altas. |
| Canales | Con teléfono: QR y mensajes por WhatsApp. Con email: además correo (credenciales, comprobantes). |
| Comprobante | En **renovación** se envía al email del socio si lo tiene. En **POS** se pide “correo para envío” al momento del cobro (no hace falta que esté registrado). |

Así el alta sigue siendo ágil y los comprobantes se envían cuando hay email (alta o en la venta).

---

## 2. Envío de QR y comprobante: correo y WhatsApp

- **QR:** Una vez al alta. Si tiene teléfono → WhatsApp. Si además tiene email → también por correo (backup). Ya está soportado.
- **Comprobante de renovación:** Cada vez que renueve. Solo por **correo** (socio con email). Con **folio** (ej. R-2025-000042) para auditoría.
- **Comprobante de venta POS:** Cada venta puede enviarse a un **correo indicado en caja** (opcional). No hace falta que el cliente esté registrado. Folio de venta (ej. V-2025-000123).

En el futuro se puede sumar “enviar comprobante por WhatsApp” con un enlace al comprobante (mismo folio, misma auditoría).

---

## 3. Folio y auditoría para el admin

- **Ventas (POS):** Cada venta tiene un **folio único** por gym y año: `V-{año}-{secuencial}` (ej. V-2025-000001). El **año es el del servidor** (no del navegador), para que todos los folios sean consistentes. Se guarda en `Sale.receipt_folio`. El admin puede buscar por folio o por venta.
- **Renovaciones:** Cada renovación (cobre o no) tiene folio `R-{año}-{secuencial}` (ej. R-2025-000001). Mismo criterio: año del servidor. Se envía en el comprobante por correo y se registra en auditoría. Si la renovación generó venta, esa venta ya tiene su propio folio V-…; el R-… identifica el evento de renovación (útil cuando el monto es 0 y no hay venta).

Así todo queda trazable: ventas por folio V, renovaciones por folio R, y el comprobante (PDF o cuerpo del correo) muestra ese folio.

---

## 4. ¿PDF o imagen?

- **Recomendación: PDF** para el comprobante (descargable, imprimible, profesional).
- La generación del PDF puede hacerse en **n8n** (el backend envía los datos; n8n arma el PDF y lo adjunta al correo). El backend no genera PDF; así se evita dependencia y se mantiene una sola capa de plantillas en n8n.

Si más adelante se necesita también imagen (ej. para WhatsApp), n8n puede generar PDF y además una imagen a partir del mismo contenido.

---

## 5. Comprobante para cualquier venta en POS

- **Sí:** Toda venta en POS puede tener comprobante con folio (V-…).
- En caja se muestra un campo opcional: **“Enviar comprobante a (correo)”**. Si la recepción ingresa un correo, al confirmar la venta:
  - Se crea la venta con su folio.
  - Se envía a n8n el payload de la venta (folio, ítems, total, correo).
  - n8n envía el correo al destinatario (con PDF o cuerpo con el mismo dato).
- No se requiere buscar si el cliente está registrado: **cualquier correo válido** recibe el comprobante. Si en el futuro se asocia la venta a un socio (ej. por teléfono), se puede prellenar el correo del socio, pero el flujo base es “correo opcional en esta venta”.

---

## 6. Pedir “correo o número” para enviar comprobante

- **Recomendación hoy: pedir solo correo** para el comprobante.
  - **Correo:** Envío directo del comprobante (y PDF) sin pasos extra. Sirve para registrados y no registrados.
  - **Número (teléfono):** Para enviar “por WhatsApp” haría falta: generar un enlace de comprobante (token de un solo uso), guardarlo y enviar por WhatsApp “Tu comprobante: [link]”. Es posible en una segunda fase; añade complejidad (tabla de tokens, endpoint público, plantilla WhatsApp).
- Por tanto: en POS el campo es **“Correo para comprobante (opcional)”**. Si lo dejan vacío, la venta se registra igual con folio; solo no se envía correo. Si quieren comprobante sin correo, más adelante se puede añadir “imprimir” o “enviar por WhatsApp (link)”.

---

## 7. Resumen de flujo implementado

| Momento | Folio | Envío | Destino |
|--------|--------|--------|--------|
| Alta socio | — | QR (y opcional correo con credenciales) | WhatsApp y/o correo según datos |
| Renovación | R-YYYY-NNN | Comprobante (plan, monto, vigencia) | Correo del socio (si tiene cuenta con email) |
| Venta POS | V-YYYY-NNN | Comprobante (ítems, total) | Correo opcional indicado en caja |

- **Admin:** Puede auditar por folio (V o R), por venta, por turno y por evento de renovación. El **detalle de ventas por turno** (ventas agrupadas por folio con desglose por producto) está en **Cortes de caja** → botón **Transacciones** de cada turno; el log de **Auditoría** registra eventos (acciones), no el desglose de cada ticket.
- **Formato:** n8n recibe los datos y puede armar PDF (y/o cuerpo de correo) con folio, gym, fecha, detalle y total.

---

## 8. Implementado en código

- **Tabla `ReceiptSequence`:** Por gym y año, secuencias `sale_seq` y `renewal_seq` para folios únicos.
- **`Sale.receipt_folio`:** Folio V-YYYY-NNNNNN asignado al crear la venta (en la misma transacción).
- **POS:** Body opcional `customer_email`; si se envía, tras crear la venta se llama al webhook `sale_receipt` con folio, ítems y total. En el front (Recepción → POS) hay campo opcional "Enviar comprobante a (correo)".
- **Renovación:** Se obtiene folio R-YYYY-NNNNNN, se incluye en el payload de `member_receipt` y en el evento de auditoría `SUBSCRIPTION_RENEWED`.
- **Alta de socio:** El correo sigue siendo opcional; no se obliga.

---

## 9. Deuda técnica evitada

- Folio secuencial por gym y año (tabla de secuencia), sin colisiones.
- Un solo concepto de “comprobante” para venta (V) y renovación (R).
- Envío por correo sin depender de que el cliente esté registrado en POS.
- Email en alta opcional; comprobante de renovación solo cuando hay email; comprobante de POS cuando la recepción ingresa correo.
- Generación de PDF en n8n; backend solo envía payload (sin librerías de PDF).

Este documento se actualiza según se implementen fases adicionales (ej. envío por WhatsApp con link al comprobante).
