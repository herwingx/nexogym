# Estrategia: Promociones, inscripción y planes pareja/familiar

Este documento analiza cómo soportar en NexoGym:
- **Panel de promociones (Admin)**: cada gym crea sus propias promos (San Valentín, Navidad, Parejas, etc.)
- Precio fijo o descuento % sobre plan base (admin define)
- Badge identificador por promo (aparece en panel de socios)
- Cobro según configuración de la promo
- Acceso individual (no afecta si llegan solos: cada socio tiene su propia suscripción)

**Objetivo:** Flexibilidad para cada gym. Admin crea promos con precio asignado o descuento %; templates de cajón (Inscripción, Pareja, Familiar, Descuento producto). Activar/desactivar sin eliminar. Integración en POS/ERP sin deuda técnica.

---

## 1. Situación actual

### 1.1 Modelo existente

| Entidad | Descripción |
|---------|-------------|
| **User** | Socio o staff. Cada socio tiene `role: MEMBER`. |
| **Subscription** | 1:1 con User. `status`, `expires_at`, `plan_barcode` (ej. MEMBERSHIP, MEMBERSHIP_ANNUAL). |
| **Product** | Planes como `MEMBERSHIP`, `MEMBERSHIP_WEEKLY`, etc. Admin define precio en Inventario. |
| **Sale / SaleItem** | Venta POS o renovación. Items = productos con precio histórico. |

### 1.2 Check-in (acceso)

El check-in valida por **usuario individual**:

- Si es staff → entra sin suscripción
- Si es socio → requiere `Subscription` con `status: ACTIVE` y `expires_at > now`

**Cada socio tiene su propia Subscription.** No existe concepto de “grupo” o “familia” en el modelo actual; el acceso se valida por User → Subscription.

### 1.3 Renovación actual

- `PATCH /users/:id/renew` con `barcode` del plan
- Precio del producto en Inventario (admin lo define)
- Se crea `Sale` si precio > 0 y hay turno abierto
- Se extiende/crea la Subscription de **ese** usuario

### 1.4 Lo que no existe hoy

- Promociones creadas por admin (San Valentín, Navidad, Parejas, etc.)
- Cobro de inscripción (one-time)
- Planes pareja/familiar (cobro único, múltiples participantes)
- Badges “Pareja”, “Familiar” en listado de socios

---

## 2. Panel de Promociones (Admin) — enfoque flexible

### 2.1 Por qué flexibilidad

**Problema:** Si las promociones son fijas (Pareja, Familiar), todos los gyms tendrían las mismas. Un gym quiere "Promo San Valentín 25% descuento", otro "Promo Navidad 2x1", otro "Promo Parejas $800 fijo".

**Solución:** El admin crea sus propias promociones con nombre, tipo, precio/descuento y badge. El sistema soporta el cobro según la configuración.

### 2.2 Modos de precio

| Modo | Descripción | Ejemplo |
|------|-------------|---------|
| **FIXED** | Precio fijo asignado por admin; sin cálculo | Promo Parejas = $800 (total para 2) |
| **DISCOUNT_PERCENT** | Descuento % sobre precio actual del producto en Inventario | Promo Navidad 25% off MEMBERSHIP; Promo Proteína 10% off |

**Cálculo para DISCOUNT_PERCENT:**
- Base = precio actual del producto (`Product.price` en Inventario) al momento de la venta.
- Puede ser membresía (MEMBERSHIP, etc.) o cualquier producto de stock (proteína, etc.).
- Precio final = `base * (1 - discount/100)`.
- Cuando la promo está **inactiva**: no aparece en POS; se cobra precio normal del producto.

### 2.3 Viabilidad

| Aspecto | Viable | Notas |
|---------|--------|-------|
| Precio fijo | Sí | Admin define monto; se usa tal cual en Sale |
| Descuento % | Sí | Se consulta base_product.price en BD y calcula |
| Badge por promo | Sí | Campo `badge` en Promotion; se muestra en Subscription |
| Vigencia (fechas) | Sí | `valid_from`, `valid_until` en Promotion |
| Promos activas/inactivas | Sí | Toggle `active`; staff solo ve activas; no se eliminan para reutilizar |
| Actualización al staff | Sí | Al activar/desactivar, staff ve cambios al cargar/refrescar POS (`GET /promotions?active=true`) |

El flujo de cobro es el mismo que hoy: se crea una Sale con el monto calculado o fijo y se registra. No hay monto manual; todo deriva de la promo configurada. Promo desactivada = no aparece en POS; se cobra precio normal del producto.

---

## 3. Requisitos

| Requisito | Descripción |
|-----------|-------------|
| Promociones de inscripción | Admin define promos activas; recepcionistas/staff ven solo las activas. |
| Cobro inscripción | Monto fijo (admin) cobrable al alta o renovación. Opcional por gym. |
| Planes pareja/familiar | En POS: seleccionar promo “Pareja” o “Familiar”, elegir participantes, cobro único. |
| Precio definido por admin | No montos manuales; todo sale de Inventario/Config. |
| Badges en panel | Marcar socios como “Pareja”, “Familiar” (no solo “Mensual”, “Anual”). |
| Acceso individual | Si un socio de plan familiar llega solo, entra con su propio QR/suscripción. Sin cambios en check-in. |

---

## 4. Principio clave: acceso individual

**Pregunta:** Si un socio de plan familiar llega solo, ¿entra normal?

**Respuesta:** Sí. Cada socio debe tener **su propia Subscription** con `status: ACTIVE` y `expires_at` vigente. El check-in no distingue si esa suscripción viene de un plan individual o familiar; solo valida que exista y esté activa.

Por tanto:

- Los planes pareja/familiar no modifican la lógica de acceso.
- Cada participante tiene su propia Subscription (misma fecha de vencimiento si están en el mismo “grupo”).
- Al vender “Pareja” o “Familiar”, el sistema crea/actualiza N suscripciones y registra 1 venta.

---

## 5. Estrategia propuesta (modelo de datos)

### 5.1 Dos capas: productos y promociones

1. **Productos (Inventario)**  
   Continúan siendo la fuente de precios. Se añaden productos para:
   - Inscripción: `INSCRIPTION`
   - Pareja: `MEMBERSHIP_PAREJA`
   - Familiar: `MEMBERSHIP_FAMILIAR`

2. **Promociones (entidad nueva)**  
   Para controlar qué está activo, vigencia y reglas:
   - Admin define qué promociones están activas
   - Staff/recepción solo ve promociones activas en POS / renovación
   - La promo referencia un producto (precio) y reglas (participantes, días, etc.)

### 5.2 Modelo de datos (extensión mínima)

#### A) Nuevos productos plantilla

```ts
// default-products.ts
{ barcode: 'INSCRIPTION', name: 'Inscripción', price: 0, stock: 99_999 },
{ barcode: 'MEMBERSHIP_PAREJA', name: 'Membresía Pareja', price: 0, stock: 99_999 },
{ barcode: 'MEMBERSHIP_FAMILIAR', name: 'Membresía Familiar', price: 0, stock: 99_999 },
```

Admin configura precio en Inventario como con cualquier plan.

#### B) Tabla `Promotion` (creada por admin, flexible)

```prisma
model Promotion {
  id                   String   @id @default(uuid()) @db.Uuid
  gym_id               String   @db.Uuid
  name                 String   // "Promo San Valentín", "Promo Parejas", "Promo Navidad"
  badge                String   // "San Valentín", "Pareja", "Navidad" — muestra en panel socios
  type                 String   // INSCRIPTION | PLAN_INDIVIDUAL | PLAN_PAREJA | PLAN_FAMILIAR | PRODUCTO
  pricing_mode         String   // FIXED | DISCOUNT_PERCENT
  base_product_barcode String?  // Para DISCOUNT_PERCENT: MEMBERSHIP, MEMBERSHIP_ANNUAL, etc.
  fixed_price          Decimal? @db.Decimal(10,2)  // Para FIXED: monto exacto
  discount_percent     Int?     // Para DISCOUNT_PERCENT: 0-100
  days                 Int?     // null = inscripción (0), 30 = mensual, 365 = anual
  min_members          Int      @default(2)  // Pareja: 2, Familiar: 2–4
  max_members          Int      @default(2)  // Pareja: 2, Familiar: 4
  active               Boolean  @default(true)
  valid_from           DateTime?
  valid_until          DateTime?
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt

  gym Gym @relation(...)
}
```

- **FIXED**: admin define `fixed_price` (ej. Promo Parejas = $800 total).
- **DISCOUNT_PERCENT**: admin define `base_product_barcode` + `discount_percent`. Base = precio actual del producto en Inventario (puede ser MEMBERSHIP, proteína, etc.). Se calcula al momento de la venta.

#### C) Tabla `SubscriptionGroup` (grupos pareja/familiar)

Para mantener N suscripciones vinculadas y con la misma fecha de vencimiento:

```prisma
model SubscriptionGroup {
  id         String   @id @default(uuid()) @db.Uuid
  gym_id     String   @db.Uuid
  plan_type  String   // PAREJA | FAMILIAR
  created_at DateTime @default(now())

  gym           Gym            @relation(...)
  subscriptions Subscription[]
}

model Subscription {
  // ... campos actuales
  subscription_group_id String? @db.Uuid  // null = individual

  subscription_group SubscriptionGroup? @relation(...)
}
```

- `subscription_group_id = null` → plan individual
- `subscription_group_id` no null → pertenece a pareja/familiar

#### D) Inscripción

- Opción A: Producto `INSCRIPTION` vendido por separado en POS (alta o renovación).
- Opción B: Flag `include_inscription` en alta/renovación, que añade el cobro del producto INSCRIPTION si el gym lo tiene configurado.

### 5.3 Flujos

#### Alta de socio con inscripción

1. Crear User (alta normal).
2. Crear Subscription con `PENDING_PAYMENT`.
3. Si el gym cobra inscripción: vender producto `INSCRIPTION` en POS (mismo turno).
4. Renovar (cobrar membresía) si aplica.

#### Venta plan Pareja/Familiar (POS)

1. Staff elige promo activa (ej. "Promo San Valentín", "Promo Parejas").
2. Selecciona participantes (2 para pareja, 2–4 para familiar):
   - Socios existentes O altas nuevas.
3. Backend calcula precio según la promo (FIXED → fixed_price; DISCOUNT_PERCENT → base_product.price × (1 - discount/100) × participantes).
4. Backend:
   - Crea `SubscriptionGroup`.
   - Crea/actualiza N `Subscription` con misma `expires_at`, `promotion_id` y badge.

#### Badge en panel de socios

- Si `subscription.promotion_id` está set: usar `Promotion.badge` (ej. "San Valentín", "Pareja").
- Si no: usar `plan_barcode` + `PLAN_BARCODE_LABELS` como hoy “Mensual”, “Anual”, etc.

### 5.4 API sugerida

| Endpoint | Descripción |
|----------|-------------|
| `GET /promotions` | Lista promociones (admin: todas; staff: solo `active`) |
| `POST /promotions` | Admin crea promo (nombre, badge, tipo, FIXED/DISCOUNT_PERCENT, precios) |
| `PATCH /promotions/:id` | Admin edita/activa/desactiva |
| `POST /pos/sales` o nuevo | Venta con promo: `{ promotionId, participantIds[], newMembers[] }` — calcula precio según promo |

#### Panel Admin: Promociones

- Ruta: `/admin/promotions`
- CRUD: crear, editar, activar/desactivar promos
- Formulario: nombre, badge, tipo (Inscripción, Pareja, Familiar, Descuento mensualidad, Descuento producto), modo de precio (Fijo / Descuento %), base (producto si aplica), precio fijo o %, días, vigencia (opcional), activo/inactivo

---

## 6. Alternativa simplificada (fase 1)

Si se quiere minimizar cambios iniciales:

1. **Productos nuevos**: `INSCRIPTION`, `MEMBERSHIP_PAREJA`, `MEMBERSHIP_FAMILIAR`.
2. **Sin tabla Promotion**: las “promociones” son los productos con precio > 0 en Inventario. Admin activa/desactiva desactivando productos o usando un flag `active` en Product.
3. **Sin SubscriptionGroup**: cada Subscription sigue siendo independiente. Al vender Pareja:
   - Cobro una vez (producto MEMBERSHIP_PAREJA).
   - Se crean 2 suscripciones con misma `expires_at` y `plan_barcode`.
4. **Badge**: añadir `MEMBERSHIP_PAREJA` y `MEMBERSHIP_FAMILIAR` a `PLAN_BARCODE_LABELS`.

Ventaja: poca migración. Desventaja: menos control de vigencia y reglas por promo.

---

## 7. Conclusiones y decisiones finales

### 7.1 Templates de cajón (tipos de promo predefinidos)

En lugar de cálculos genéricos, el admin elige un **tipo de promo** y configura:

| Tipo template | Admin define | Uso típico |
|---------------|--------------|------------|
| **Inscripción** | Precio fijo | $200 inscripción |
| **Pareja** | Precio fijo (total para 2) | $800 pareja |
| **Familiar** | Precio fijo (total 2–4) | $1,200 familiar |
| **Descuento mensualidad** | Producto base + % descuento | 25% off MEMBERSHIP |
| **Descuento producto** | Producto base + % descuento | 10% off proteína |

- **Precio fijo**: admin asigna el monto; no se calcula nada. Para Inscripción, Pareja, Familiar.
- **Descuento %**: base = precio actual del producto en Inventario (`Product.price`). Puede ser membresía o cualquier producto de stock (proteína, etc.).

### 7.2 Activar / Desactivar (no eliminar)

- Campo `active: Boolean` en la promo.
- **Inactiva**: no aparece en el selector del POS; el staff cobra precio normal del producto.
- **Activa**: aparece en el POS con precio promocional.
- Se usa **toggle**; no se eliminan promos para reutilizarlas (ej. San Valentín, Navidad cada año).

### 7.3 Actualización al staff

- Al **activar** una promo → el staff la ve en el POS al cargar o refrescar.
- Al **desactivar** → deja de aparecer; se cobra precio normal.
- `GET /promotions` filtra `active: true` para staff; admin ve todas.

### 7.4 Integración en POS / ERP

| Componente | Integración |
|------------|-------------|
| Sale | Misma estructura; total = precio de la promo (fijo o calculado). |
| SaleItem | product_id + price histórico; mismo flujo que hoy. |
| CashShift | Sale se vincula al turno abierto (`cash_shift_id`). |
| Folios | `getNextSaleFolio()` — mismo formato V-YYYY-NNNNNN. |
| Cortes de caja | Las promos suman al total del turno automáticamente. |

Todo integra en el flujo existente sin deuda técnica.

### 7.5 Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Acceso individual | No cambia. Cada socio tiene su Subscription; check-in igual. |
| Planes pareja/familiar | N suscripciones, misma `expires_at`; 1 cobro. |
| Precio fijo (Inscripción, Pareja, Familiar) | Admin asigna monto; sin cálculo. |
| Descuento % | Base = precio actual del producto en Inventario (membership, proteína, etc.). |
| Promo activa | Staff ve promo en POS; cobra con descuento/precio promo. |
| Promo inactiva | No aparece en POS; se cobra precio normal del producto. |
| Activar/Desactivar | Toggle `active`; no eliminar para reutilizar. |
| Badges | Si promo: `Promotion.badge`. Si no: `plan_barcode` + labels. |
| Inscripción | Producto `INSCRIPTION` o promo tipo Inscripción cobrable en alta/renovación. |

---

## 8. Orden de implementación sugerido

1. **Tabla `Promotion`** y CRUD Admin: panel `/admin/promotions` para crear/editar promos (nombre, badge, tipo, FIXED/DISCOUNT_PERCENT).
2. **Productos base**: asegurar que `INSCRIPTION` y productos MEMBERSHIP existan en Inventario para calcular descuentos.
3. **Endpoint venta con promo**: aceptar `promotionId` + `participantIds[]`; calcular precio según promo y crear Sale + N Subscriptions.
4. **UI POS**: selector de promociones activas + selección de participantes (pareja/familiar).
5. **Subscription.promotion_id** y badge: mostrar `Promotion.badge` en listados de socios.
6. **SubscriptionGroup** (opcional): para auditoría y renovación grupal futura.

---

## Referencias

- [SUBSCRIPTION_EXPIRY_AND_RENEWAL.md](./SUBSCRIPTION_EXPIRY_AND_RENEWAL.md) – Renovación y estados
- [default-products.ts](../backend/src/data/default-products.ts) – Productos plantilla
- [checkin.controller.ts](../backend/src/controllers/checkin.controller.ts) – Lógica de acceso
