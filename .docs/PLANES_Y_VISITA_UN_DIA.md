# Planes de membresía (semanal, bimestral, semestral, anual) y visita 1 día

Análisis de cómo soportar varios planes en renovación, badge en lista de socios, y el flujo de visita de un día (cuándo registrarlos, control sin torniquete, incentivos para no cobrar por debajo del agua).

---

## 1. Complemento: toast al renovar con precio 0

- **Estado:** Implementado en Recepción (Socios). Al renovar, si el producto Membresía 30 días tiene precio 0, el toast dice: *"Suscripción renovada. El precio está en $0; no se registró cobro en caja. Si quieres registrar el pago, configura el precio en Inventario (Membresía 30 días)."*
- Así se complementa con el banner de Inventario y el mensaje de error cuando falta el producto: el admin/recep sabe que puede operar pero que no se registra cobro hasta que asigne precio.

---

## 2. Múltiples planes (semanal, quincenal, bimestral, semestral, anual)

### 2.1 Objetivo

- En **Renovar** no solo "mensual de cajón": poder elegir **plan** (semanal, quincenal, mensual, bimestral, semestral, anual).
- En la **lista de socios** (recepción y admin) mostrar un **badge** con el plan actual (ej. "Mensual", "Anual") para saber qué tipo de membresía tiene cada uno.

### 2.2 Modelo de datos

- **Productos plantilla** (ya existen o se amplían): cada plan es un producto con barcode reservado y días a sumar:
  - `MEMBERSHIP_WEEKLY` → 7 días  
  - `MEMBERSHIP_BIWEEKLY` → 14 días  
  - `MEMBERSHIP` → 30 días  
  - `MEMBERSHIP_BIMESTRAL` → 60 días  
  - `MEMBERSHIP_SEMESTRAL` → 180 días  
  - `MEMBERSHIP_ANNUAL` → 365 días  
- **Subscription:** hoy solo tiene `expires_at`. Para mostrar el badge "Mensual" / "Anual" sin adivinar, conviene guardar el **plan con el que se renovó** (o el producto usado). Opciones:
  - **A)** Campo `plan_barcode` (String, opcional) en `Subscription`: al renovar se guarda el barcode del producto usado; en listados se traduce a etiqueta ("Mensual", "Anual", etc.).
  - **B)** Campo `last_renewal_product_id` (FK a Product): mismo fin, pero acoplado al producto concreto del gym.
- Recomendación: **A)** `plan_barcode` (nullable). Si es null, se puede mostrar "Mensual" por defecto para suscripciones antiguas (retrocompatibilidad).

### 2.3 Backend

- **PATCH /users/:id/renew**  
  - Body opcional: `{ "productId": "uuid" }` o `{ "barcode": "MEMBERSHIP_ANNUAL" }`.  
  - Si no se envía, usar producto con barcode `MEMBERSHIP` (30 días) como hoy.  
  - Buscar el producto en el gym; obtener precio (registrar venta si precio > 0 y hay turno) y **días a sumar** según mapa barcode → días.  
  - Actualizar `Subscription`: `expires_at`, `status`, y **`plan_barcode`** (o el campo que se elija).  

- **Mapa barcode → días** en código (const o en `default-products`): único lugar de verdad para semanal=7, mensual=30, anual=365, etc.

### 2.4 Frontend

- **Modal Renovar:** en recepción (y admin si aplica), además del botón "Renovar" mostrar **selector de plan**: Semanal, Quincenal, Mensual, Bimestral, Semestral, Anual (solo los que el gym tenga dados de alta en Inventario con precio > 0, o todos con precio ≥ 0). Al confirmar, enviar `barcode` o `productId` en el body del renew.
- **Lista de socios:** columna o badge con el plan actual (usando `subscription.plan_barcode` o equivalente). Si `plan_barcode` es null, mostrar "Mensual" por defecto.

### 2.5 Productos plantilla

- Ampliar `DEFAULT_GYM_PRODUCTS` (o equivalente) con: Bimestral (60), Semestral (180), Anual (365). El admin asigna precio a los que use; el resto pueden quedarse en 0 y no mostrarse en el selector o mostrarse igual para que los configure.

---

## 3. Visita de 1 día

### 3.1 ¿Hay que "registrarlos"?

- **No como socio nuevo.** Una visita de 1 día es un **producto que se vende en POS** (ya existe "Visita 1 día" con barcode `VISIT_1`).  
- **Si la persona ya está registrada** (ex socio dado de baja): sigue siendo el mismo User; no hace falta alta nueva. Solo se cobra la visita en POS y, si se quiere dar acceso controlado, se le asigna 1 día de acceso (ver abajo).  
- **Si es alguien no registrado:** se puede (a) solo vender en POS (venta anónima) y que entren por control manual, o (b) opcionalmente dar de alta como "visitante" o reutilizar un User con rol MEMBER y suscripción de 1 día. La opción (a) es la mínima y evita crear registros innecesarios.

### 3.2 Cobro y registro

- **Venta en POS:** el recepcionista vende el producto "Visita 1 día"; queda registrada la `Sale` y el `SaleItem`. Eso ya es el comprobante de pago (auditoría, corte de caja).  
- **Opcional – asignar 1 día de acceso a un usuario conocido:** si al vender "Visita 1 día" se asocia la venta a un User (ej. por teléfono), se puede tener un flujo "aplicar día de visita a este socio" que: cree o actualice una suscripción con `expires_at = hoy + 1 día`. Así ese usuario puede usar QR/magnética si el gym tiene control de acceso. Si no hay control de acceso, no es obligatorio; la venta en POS basta.

### 3.3 Incentivos para no cobrar "por debajo del agua"

- **Ticket por correo:** si en la venta de "Visita 1 día" (o cualquier venta) se captura email y se envía un comprobante por correo, el cliente tiene prueba y el gym tiene registro. Eso desincentiva cobrar sin registrar: si no hay venta, no hay correo y el cliente podría reclamar. Requiere: (1) campo/opción email en la venta POS (opcional o obligatorio para visita 1 día), (2) integración n8n/email para enviar el ticket.  
- **Reportes para el admin:** un reporte tipo "Ventas de visita 1 día por día" vs "Check-ins manual ese día" (o "entradas sin suscripción activa") ayuda a ver discrepancias. No evita la fricción pero da control.  
- **Sin torniquete/magnética:** no se puede impedir físicamente que alguien entre sin pagar. Lo que sí se puede es: (1) auditoría (ventas, cortes de caja), (2) comprobante al cliente (email), (3) cultura y procedimientos (recepción debe registrar toda venta). No hay solución 100% técnica sin control de acceso físico.

### 3.4 Resumen visita 1 día

| Pregunta | Respuesta |
|----------|-----------|
| ¿Registrar visitantes como socios? | No obligatorio. Pueden ser solo venta en POS. Si se quiere dar acceso por QR/magnética a un ex socio, opcionalmente "aplicar 1 día" a ese User. |
| ¿Ex socio que paga visita? | Mismo User; solo se cobra "Visita 1 día" en POS. Opcional: extender suscripción 1 día para que use QR. |
| ¿Cómo evitar cobro bajo el agua? | Ticket por correo (comprobante), reportes ventas vs check-ins, auditoría. Sin control de acceso físico el control es procedimental y de trazabilidad. |

---

## 4. Orden de implementación sugerido

1. **Toast precio 0** – Hecho.  
2. **Productos plantilla** – Hecho (bimestral, semestral, anual + mapa `PLAN_BARCODE_DAYS`).  
3. **Subscription.plan_barcode** – Hecho (campo en schema + db push).  
4. **Renew con plan** – Hecho: body opcional `{ barcode: string }`; backend usa producto con ese barcode y días de `PLAN_BARCODE_DAYS`.  
5. **UI Renovar** – Hecho: selector de plan en modal (Recepción y Admin).  
6. **Badge plan en lista de socios** – Hecho: columna "Plan" con etiqueta (Mensual, Anual, etc.) desde `plan_barcode`.  
7. **Comprobante por correo (renovación)** – Hecho: al renovar cualquier plan, si el socio tiene email (cuenta con correo), se envía un webhook `member_receipt` a n8n (`/webhook/comprobante-socio`) con plan, monto, vigencia; n8n puede enviar el email al socio. Ver `.docs/CANALES_COMUNICACION.md` § 2.2.  
8. **Visita 1 día (opcional):** pendiente: email en venta POS + envío de comprobante; opcional "aplicar 1 día" a un usuario; reporte ventas visita 1 día vs entradas manuales.

Este documento se puede ir actualizando según se implemente cada punto.
