# Contratos de la API (API_SPEC)

Actualizado tras la implementación del ERP Full (Sprints B1–B9).

## Convención de Rutas Base
```
/api/v1/[recurso]     → Rutas protegidas con JWT (Supabase Bearer Token)
/biometric/[recurso]  → Rutas de hardware IoT protegidas con x-api-key
```

## Autenticación

| Header | Valor | Rutas |
|---|---|---|
| `Authorization` | `Bearer <supabase-jwt>` | Todas las rutas `/api/v1/*` |
| `x-api-key` | `<api_key_hardware>` | Rutas `/biometric/*` |

El middleware extrae del JWT: `req.gymId`, `req.user.id`, `req.userRole`.

---

## Sprint B3 — Gestión de Socios (CRM)

### `GET /api/v1/users`
Lista todos los socios activos del gimnasio (excluye soft-deleted).

### `POST /api/v1/users`
Crea usuario + suscripción en una transacción ACID. Dispara webhook n8n de bienvenida.
```json
// Body
{ "name": "Juan Pérez", "phone": "+521234567890", "pin": "1234", "role": "MEMBER" }
// Response 201
{ "id": "uuid", "message": "Usuario creado satisfactoriamente.", "assigned_pin": "1234" }
```

### `PATCH /api/v1/users/:id`
Modifica nombre o teléfono. Registra en `AuditLog`.

### `DELETE /api/v1/users/:id`
**Soft delete** — actualiza `deleted_at`. NUNCA borra físicamente.

### `PATCH /api/v1/users/:id/renew`
Suma 30 días al `expires_at`. Si la suscripción está vencida, suma desde hoy.

### `PATCH /api/v1/users/:id/freeze`
Cambia estado a `FROZEN`, guarda `frozen_days_left`. Registra en `AuditLog`.

### `PATCH /api/v1/users/:id/unfreeze`
Reactiva la suscripción sumando los días guardados desde la fecha actual.

---

## Sprint B4 — Control de Accesos y Gamificación

### `POST /api/v1/checkin`
Validación de suscripción + cálculo de racha + evaluación de recompensas.
```json
// Body
{ "userId": "uuid" }
// Response 200
{ "success": true, "newStreak": 5, "rewardUnlocked": true, "message": "¡Premio desbloqueado: Agua 1L!" }
```

### `POST /api/v1/checkin/courtesy`
**Solo ADMIN/SUPERADMIN.** Permite entrada a usuario sin suscripción activa.
Marca visita como `access_type: COURTESY`. Registra en `AuditLog` quién autorizó.
```json
// Body
{ "userId": "uuid", "reason": "Olvidó cartera" }
// Response 200
{ "success": true, "message": "Courtesy access granted to Juan Pérez.", "visit_id": "uuid" }
```

---

## Sprint B5 — Control de Inventario

### `GET /api/v1/inventory/products`
Catálogo de productos activos (excluye soft-deleted).

### `POST /api/v1/inventory/products`
Crea un producto nuevo en el inventario.
```json
{ "name": "Agua 1L", "barcode": "750123", "price": 15.00, "stock": 50 }
```

### `DELETE /api/v1/inventory/products/:id`
Soft delete del producto.

### `POST /api/v1/inventory/restock`
Recibe mercancía. Transacción ACID: suma stock + crea `InventoryTransaction RESTOCK`.
```json
{ "productId": "uuid", "quantity": 24, "reason": "Compra semanal" }
```

### `POST /api/v1/inventory/loss`
Baja de producto por merma/rotura. `reason` **obligatorio** (política anti-robo).
Transacción ACID + registro en `AuditLog`.
```json
{ "productId": "uuid", "quantity": 2, "reason": "Botella rota durante limpieza" }
```

---

## Sprint B6 — Punto de Venta (POS) y Egresos

### `GET /api/v1/pos/products`
Catálogo del POS (misma fuente que inventario, vista optimizada).

### `POST /api/v1/pos/sales`
Venta completa. Requiere turno abierto. Transacción ACID:
1. Valida stock de cada producto
2. Descuenta stock
3. Crea `Sale` vinculada al turno activo (`cash_shift_id`)
4. Crea `SaleItem` con precio histórico
5. Crea `InventoryTransaction SALE` por cada producto
```json
// Body
{ "items": [{ "productId": "uuid", "quantity": 2 }] }
// Response 201
{ "message": "Sale completed successfully.", "sale": { "id": "uuid", "total": 30.00 } }
```

### `POST /api/v1/pos/expenses`
Registra egreso de caja en el turno activo.
```json
{ "amount": 50.00, "description": "Pago de garrafones" }
```

---

## Sprint B7 — Control de Turnos de Caja

### `POST /api/v1/pos/shifts/open`
Abre un nuevo turno. Solo se permite uno activo por gimnasio.
```json
{ "opening_balance": 500.00 }
```

### `POST /api/v1/pos/shifts/close`
Cierra el turno. El sistema calcula y compara:
```
Expected = Opening Balance + Ventas POS - Egresos
Difference = Actual (físico declarado) - Expected
```
Dispara webhook n8n → WhatsApp al dueño con resumen.
```json
// Body
{ "actual_balance": 1230.00 }
// Response 200
{
  "reconciliation": {
    "opening_balance": 500.00,
    "total_sales": 780.00,
    "total_expenses": 50.00,
    "expected": 1230.00,
    "actual": 1230.00,
    "difference": 0,
    "status": "BALANCED"
  }
}
```

---

## Sprint B8 — Analytics y Auditoría

### `GET /api/v1/analytics/occupancy`
Semáforo en tiempo real. Cuenta visitas en los últimos 90 minutos.
```json
{ "activeUsers": 12, "status": "NORMAL" }
// status: "VACÍO" | "NORMAL" | "LLENO"
```

### `GET /api/v1/analytics/revenue/daily`
Ingresos totales del día actual.

### `GET /api/v1/analytics/financial-report?month=2026-02`
Reporte mensual completo. `month` es opcional (default: mes actual).
```json
{
  "period": { "start": "2026-02-01", "end": "2026-02-28" },
  "income": { "pos_sales": 15200.00, "sale_count": 84, "memberships_created": 23 },
  "expenses": { "total": 340.00, "expense_count": 7 },
  "inventory": { "loss_transactions": 3 },
  "net_profit": 14860.00
}
```

### `GET /api/v1/analytics/audit-logs?action=COURTESY_ACCESS_GRANTED&limit=50&page=1`
Historial de auditoría paginado. Filtros opcionales: `action`, `userId`.
Permite al dueño detectar cortesías abusivas y mermas fraudulentas.

---

## Sprint B9 — IoT Biométrico (ZKTeco)

### `POST /biometric/checkin`
**Auth:** `x-api-key: <api_key_hardware>` (sin JWT).
El torniquete envía el ID biométrico, el sistema valida membresía y responde si abrir la puerta.
```json
// Body
{ "footprint_id": "hash-biometrico" }
// Response 200 — autorizado
{ "openDoor": true, "message": "Welcome!", "newStreak": 7 }
// Response 200 — denegado
{ "openDoor": false, "reason": "Subscription Expired or Inactive" }
```

---

## Integración con Webhooks (n8n)

Todas las llamadas a n8n son **fire-and-forget** (no bloquean el response al cliente).

| Webhook | Ruta n8n | Disparador |
|---|---|---|
| Bienvenida nuevo socio | `/webhook/nuevo-cliente` | `POST /users` |
| Premio desbloqueado | `/webhook/recompensa` | `POST /checkin` cuando `rewardUnlocked: true` |
| Resumen corte de caja | `/webhook/corte-caja` | `POST /pos/shifts/close` |

```json
// Payload webhook bienvenida
{ "phone": "+521234567890", "pin": "1234", "qrData": "GYM_QR_uuid" }

// Payload webhook corte de caja
{
  "phone": "+521234567890",
  "openedAt": "2026-02-23T08:00:00Z",
  "closedAt": "2026-02-23T20:00:00Z",
  "openingBalance": 500,
  "totalSales": 780,
  "expectedBalance": 1230,
  "actualBalance": 1230,
  "difference": 0
}
```
