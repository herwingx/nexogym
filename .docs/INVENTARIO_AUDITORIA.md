# Inventario: auditoría y trazabilidad

Documento de referencia: qué se audita en inventario, quién puede hacer qué, y cómo se rastrea cada movimiento.

---

## 1. Auditoría (AuditLog)

Todas las acciones sensibles de inventario quedan registradas en `AuditLog` con `user_id` y `action`:

| Acción | Evento AuditLog | Quién | Detalle |
|--------|-----------------|-------|---------|
| Crear producto | `PRODUCT_CREATED` | Admin | product_id, name, barcode, price, stock |
| Editar producto | `PRODUCT_UPDATED` | Admin | product_id, price_before/after, name_before/after, barcode_before/after |
| Borrar producto (soft) | `PRODUCT_DELETED` | Admin | product_id, name, barcode |
| Restock (agregar stock) | `INVENTORY_RESTOCKED` | Admin o staff con POS | product_id, product_name, quantity, reason, transaction_id |
| Merma (sacar stock) | `INVENTORY_LOSS_REPORTED` | Admin | product_id, product_name, quantity_lost, reason, transaction_id |

La auditoría se consulta en **Auditoría** (`/admin/audit`) con filtros por `action` y `user_id`. Todas las acciones se muestran con etiquetas en español (ej. `PRODUCT_DELETED` → "Producto eliminado", `INVENTORY_RESTOCKED` → "Stock repuesto").

---

## 2. Permisos por rol

| Operación | Admin | Recep/Coach con POS |
|-----------|-------|---------------------|
| Crear producto | ✅ | ❌ |
| Editar precio/nombre/barcode | ✅ | ❌ |
| Borrar producto | ✅ | ❌ |
| Restock (agregar stock) | ✅ | ✅ |
| Merma (sacar stock) | ✅ | ❌ |
| Ver productos y transacciones | ✅ | ✅ |
| Vender en POS | ✅ | ✅ |

Restock: cuando llega el proveedor, recepcionista o coach con permiso POS puede agregar unidades. No puede restar (merma) ni editar precios; eso queda reservado al admin para control anti-fraude.

---

## 3. InventoryTransaction y user_id

Cada movimiento de inventario (RESTOCK, LOSS, SALE) se registra en `InventoryTransaction` con `user_id` opcional:

- **RESTOCK:** `user_id` = quien realizó el reingreso.
- **LOSS:** `user_id` = quien reportó la merma (Admin).
- **SALE:** `user_id` = `seller_id` de la venta (quien vendió).

Así se puede rastrear quién hizo cada movimiento. Transacciones antiguas pueden tener `user_id` null (retrocompatibilidad).

---

## 4. Movimientos en el corte

En **Transacciones del corte** (Admin → Cortes de caja → Transacciones por turno) se muestran:

1. **Ventas** del turno (por folio, con desglose por producto).
2. **Movimientos de inventario** (restock y merma) realizados por el cajero durante el turno: hora, tipo, producto, cantidad, motivo.

Se filtran `InventoryTransaction` donde `user_id` = usuario del turno y `created_at` entre `opened_at` y `closed_at` del turno.

---

## 5. Referencia técnica

- **Backend:** `inventory.controller.ts` (createProduct, deleteProduct, updateProduct, restockProduct, adjustLoss, getInventoryTransactions). `pos.controller.ts` (createSale crea InventoryTransaction con user_id; getShiftSales incluye inventory_movements).
- **Schema:** `InventoryTransaction.user_id` (String?); `Product` con `deleted_at` para soft delete.
- **Rutas:** `requireAdminOrSuperAdmin` en create/delete/update/loss; `requireCanUsePos` en restock y lectura.
