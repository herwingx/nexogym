# Cortes de caja y stock

Documento de referencia: cómo funcionan los turnos, el corte de caja, el stock y las restricciones para recepcionistas y admin.

---

## 1. Modelo de turnos

- **Un turno por recepcionista:** Cada usuario con rol RECEPTIONIST tiene su propio turno de caja. No hay cuenta compartida.
- **Flujo:** Abrir turno (fondo inicial) → operar (ventas y egresos) → **Cerrar turno** (corte: ingresar saldo real en caja).
- **Restricción:** No se puede abrir otro turno hasta cerrar el actual (backend devuelve 400 "You already have an open shift.").

---

## 2. Productos plantilla al crear el gym

Al dar de alta un gym (panel SaaS), se crean automáticamente estos productos en Inventario:

| Código (barcode)   | Nombre por defecto     | Uso principal                          |
|--------------------|-------------------------|----------------------------------------|
| **MEMBERSHIP**     | Membresía 30 días      | **Renovar mensualidad** en caja (obligatorio) |
| VISIT_1            | Visita 1 día            | Venta en POS si el gym vende día suelto |
| MEMBERSHIP_WEEKLY  | Membresía semanal       | Opcional; asignar precio si se usa     |
| MEMBERSHIP_BIWEEKLY| Membresía quincenal     | Opcional; asignar precio si se usa     |

Todos vienen con precio 0 y stock alto (99.999). El **admin** solo debe entrar a Inventario y **asignar el precio** al producto "Membresía 30 días" (y a los demás si los usa). No tiene que crear productos ni escribir códigos de barras (el código es interno; una membresía no tiene código físico). Así la opción "Renovar mensualidad" en el panel funciona y el cobro se registra en el turno de caja.

---

## 3. Stock de productos

- **Cuándo se actualiza:** El stock se **descuenta en el momento de la venta**, dentro de la misma transacción que crea la venta y los ítems.
- **Alcance:** El inventario es **por gym**, no por turno. Todas las ventas de todos los recepcionistas afectan el mismo stock.
- **Consecuencias:**
  - Si un recepcionista vende y **no** hace corte: el stock ya está actualizado. Otro recepcionista ve el stock correcto.
  - No hacer corte **no** afecta al stock ni al turno del otro; solo deja un turno abierto sin saldo real registrado (tema de auditoría y responsabilidad).

---

## 4. Admin vs Staff: visión de cortes

- **Admin/SuperAdmin:** Ve el **historial de todos los turnos cerrados** de todos los recepcionistas (tabla con usuario, apertura, cierre, fondo, esperado, real, estado Cuadrado/Sobrante/Faltante). Puede ver las transacciones de cualquier corte.
- **Staff con can_use_pos** (recepcionista, coach con permiso de vender): Ve **solo sus propios cortes pasados**. Puede abrir el detalle (Transacciones) de sus propios turnos; no puede ver cortes de otros usuarios.
- **Transacciones del corte:** Por cada turno, botón **"Transacciones"** → ventas del corte **agrupadas por folio** (cada bloque es un ticket/recibo); **dentro de cada folio**, desglose por producto (nombre, cantidad, precio unitario, subtotal). Encabezado de cada bloque: Folio (V-YYYY-NNNNNN), fecha, cajero, total. Además se muestran los **movimientos de inventario durante el turno** (restock y mermas) realizados por el cajero, con hora, tipo, producto, cantidad y motivo.
- **Ingresos:** Los ingresos “engloban” todos los turnos en el sentido de que cada fila es un corte cerrado; la suma de todos los cortes da el total de caja por período.
- **Turnos abiertos:** El admin ve una sección **“Turnos abiertos (sin corte)”** con la lista de recepcionistas que tienen turno abierto y aún no han hecho corte, para poder recordarles que cierren antes de salir.

**Auditoría vs Cortes de caja vs Finanzas:** **Auditoría** = registro de acciones (quién hizo qué y cuándo); no muestra desglose de ventas ni folios. **Cortes de caja** = turnos cerrados y, por turno, Transacciones con folio y desglose por venta (recibos emitidos). **Finanzas** = reporte de ingresos/gastos por período.

**Admin en recepción:** Si el admin entra a recepción (Check-in → `/reception`), en la barra superior verá el enlace **"Panel admin"** para volver al panel de administración. Todas las acciones que haga ahí (ventas, cierre de turno, egresos, check-in) quedan registradas a su usuario: cada venta guarda `seller_id`, el turno abierto se registra en **Auditoría** (SHIFT_OPENED), el cierre de turno se registra en **Auditoría** (SHIFT_CLOSED) y las transacciones del corte se ven en **Cortes de caja** con su nombre como cajero.

---

## 5. Cierre ciego (recepcionista)

- **Objetivo:** Evitar que el recepcionista "apunte" al saldo esperado; debe contar el efectivo físico y reportar solo ese monto.
- **Comportamiento:** El recepcionista solo envía `actual_balance` (efectivo contado). El backend calcula internamente `expected_balance` (fondo + ventas - egresos) y guarda la diferencia en auditoría, pero **no devuelve** esos datos en la respuesta si el rol es RECEPTIONIST: solo `200 OK` con `{ "message": "Turno cerrado exitosamente." }`.
- **UI:** En recepción no se muestra el "Saldo esperado" ni en la tarjeta de turno ni en el modal de cierre; solo el input de efectivo contado y un checkbox de confirmación. Admin/SuperAdmin sí ven el saldo esperado y la reconciliación al cerrar.

---

## 6. Tipos de egreso de caja

- **Categorías:** Cada egreso debe clasificarse en uno de: **SUPPLIER_PAYMENT** (pago a proveedores), **OPERATIONAL_EXPENSE** (gasto operativo del gym), **CASH_DROP** (retiro de efectivo por el dueño). Para los dos primeros la descripción es obligatoria (mín. 5 caracteres); para CASH_DROP es opcional.
- **Validación:** Backend y frontend exigen descripción cuando el tipo es SUPPLIER_PAYMENT u OPERATIONAL_EXPENSE.

---

## 7. Admin: controles adicionales

- **Eventos de auditoría (turnos):** Al abrir turno se registra `SHIFT_OPENED`; al cerrar normalmente `SHIFT_CLOSED`; al forzar cierre `SHIFT_FORCE_CLOSED`. Todas las etiquetas se muestran en español en la vista Auditoría (`/admin/audit`).
- **Forzar cierre:** En "Turnos abiertos (sin corte)" cada fila tiene un botón **"Forzar Cierre"** (solo Admin/SuperAdmin). Cierra el turno de forma forzada (ej. empleado salió sin corte). Auditoría: `SHIFT_FORCE_CLOSED`. Endpoint: `PATCH /api/v1/pos/shifts/:id/force-close`.
- **Super Admin — downgrade:** Al bajar de plan se muestra un **modal de confirmación** con las acciones que se ejecutarán (cierre automático de turnos abiertos, actualización de módulos, etc.). Al aceptar, el backend cierra todos los turnos abiertos del gym y aplica el nuevo tier. No hay botón «Cerrar turnos» en el dashboard Super Admin. **Upgrade** (subir de plan) no afecta los turnos; solo da acceso a más opciones (QR, gamificación, clases, biométrico). **Quitar POS en Módulos:** al desactivar el módulo POS, el backend cierra automáticamente los turnos abiertos antes de aplicar el cambio.
- **Personal (/admin/staff):** Listado de staff (usuarios con rol distinto de MEMBER). **Dar de baja** = soft delete (`deleted_at`). Usuarios inactivos: badge INACTIVO, sin acciones. Endpoint: `DELETE /api/v1/users/:id` (Admin/SuperAdmin).

---

## 8. Cerrar sesión y corte

- **Restricción:** Un recepcionista **no puede cerrar sesión** si tiene un turno abierto.
- **Comportamiento:** Al hacer clic en “Salir” en el layout de recepción:
  1. Se consulta si el usuario tiene turno abierto (`GET /pos/shifts/current`).
  2. Si **tiene turno abierto** → se muestra un modal: *“Tienes un turno de caja abierto. Debes hacer corte de caja antes de cerrar sesión…”* con botón **“Ir a cerrar turno”** (navega a `/reception`).
  3. Si **no** tiene turno abierto → se cierra sesión con normalidad.
- **Objetivo:** Asegurar que cada turno quede cerrado con su corte antes de que la persona salga, para no dejar turnos abiertos olvidados.

### 8.1 Si cierran la ventana o apagan la PC sin hacer corte

- El turno **sigue abierto** en el servidor (por usuario). No se pierde: las ventas ya están guardadas con ese `cash_shift_id`.
- **Cuando ese mismo usuario vuelve a iniciar sesión:** al entrar verá su turno activo (POS / recepción). Si intenta cerrar sesión, se le bloqueará hasta que haga corte. Así se les obliga a hacer el corte cuando regresen.
- **Si usan un solo usuario para recepción:** al día siguiente quien abra sesión con ese usuario verá el turno abierto del día anterior y deberá hacer corte (o el admin puede **Forzar cierre** desde Cortes de caja). Con un solo usuario de recepción también se puede obligar al corte: o lo hace quien vuelve a entrar o lo cierra el admin.
- **Si son varios recepcionistas:** cada uno tiene su propio turno (`user_id`). Si Ana no hizo corte y cerró el navegador, solo Ana tiene turno abierto; cuando Ana vuelva a entrar, deberá hacer corte. Pedro puede abrir su propio turno sin problema (cada usuario tiene a lo sumo un turno abierto).

---

## 9. Resumen rápido (tabla)

| Pregunta | Respuesta |
|----------|-----------|
| ¿El admin ve ingresos de todos los turnos? | Sí: en Cortes de caja ve todos los turnos **cerrados** de todos los usuarios. |
| ¿Recepcionista/coach con permiso de vender ve sus cortes? | Sí: solo sus propios cortes pasados y el detalle (transacciones) de cada uno. |
| ¿No hacer corte afecta el stock? | No. El stock se actualiza al vender, no al cerrar turno. |
| ¿Afecta al turno del otro recep? | No. Cada recep tiene su turno; el stock es común y ya queda actualizado con cada venta. |
| ¿Se puede cerrar sesión sin hacer corte? | No. Si tiene turno abierto, se bloquea el logout hasta que haga corte (modal + “Ir a cerrar turno”). |

---

## 10. Referencia técnica (archivos)

- **Backend:** `shift.controller.ts` (open/close con `logAuditEvent` SHIFT_OPENED y SHIFT_CLOSED, **forceCloseShift**), `pos.controller.ts` (createSale con `receipt_folio`, **getShiftSales** para transacciones de un corte + movimientos de inventario, getCurrentShift, getShifts, getOpenShifts). `getShifts` filtra por `user_id` si el caller no es Admin/SuperAdmin; `getShiftSales` devuelve 403 si staff intenta ver un corte ajeno. Cierre ciego: en `closeShift` se comprueba `req.userRole === RECEPTIONIST` y se responde solo `{ message }` sin reconciliación.
- **Frontend:** `ReceptionLayout.tsx` (bloqueo de logout + modal), `ReceptionPos.tsx` / `ReceptionCheckIn.tsx` (abrir/cerrar turno; **FormCloseShift** con `showExpectedBalance` según rol), **FormExpense** con select de tipo y validación de descripción, `AdminShifts.tsx` (historial + turnos abiertos + **Forzar Cierre** + **Transacciones** por corte: ventas agrupadas por folio con desglose por producto; estados Cuadrado/Sobrante/Faltante), `AdminStaffView.tsx` (personal, dar de baja).
- **Schema:** Enum `ExpenseType` (SUPPLIER_PAYMENT, OPERATIONAL_EXPENSE, CASH_DROP); modelo `Expense` con `type` y `description` opcional. Ver **DATABASE_SCHEMA.md** y **API_SPEC.md**.
