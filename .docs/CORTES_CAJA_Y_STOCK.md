# Cortes de caja y stock

Documento de referencia: cómo funcionan los turnos, el corte de caja, el stock y las restricciones para recepcionistas y admin.

---

## 1. Modelo de turnos

- **Un turno por recepcionista:** Cada usuario con rol RECEPTIONIST tiene su propio turno de caja. No hay cuenta compartida.
- **Flujo:** Abrir turno (fondo inicial) → operar (ventas y egresos) → **Cerrar turno** (corte: ingresar saldo real en caja).
- **Restricción:** No se puede abrir otro turno hasta cerrar el actual (backend devuelve 400 "You already have an open shift.").

---

## 2. Stock de productos

- **Cuándo se actualiza:** El stock se **descuenta en el momento de la venta**, dentro de la misma transacción que crea la venta y los ítems.
- **Alcance:** El inventario es **por gym**, no por turno. Todas las ventas de todos los recepcionistas afectan el mismo stock.
- **Consecuencias:**
  - Si un recepcionista vende y **no** hace corte: el stock ya está actualizado. Otro recepcionista ve el stock correcto.
  - No hacer corte **no** afecta al stock ni al turno del otro; solo deja un turno abierto sin saldo real registrado (tema de auditoría y responsabilidad).

---

## 3. Admin: visión global

- **Cortes de caja (AdminShifts):** El admin ve el **historial de todos los turnos cerrados** de todos los recepcionistas (tabla con usuario, apertura, cierre, fondo, esperado, real, estado BALANCED/SURPLUS/SHORTAGE).
- **Ingresos:** Los ingresos “engloban” todos los turnos en el sentido de que cada fila es un corte cerrado; la suma de todos los cortes da el total de caja por período.
- **Turnos abiertos:** El admin ve una sección **“Turnos abiertos (sin corte)”** con la lista de recepcionistas que tienen turno abierto y aún no han hecho corte, para poder recordarles que cierren antes de salir.

---

## 4. Cierre ciego (recepcionista)

- **Objetivo:** Evitar que el recepcionista "apunte" al saldo esperado; debe contar el efectivo físico y reportar solo ese monto.
- **Comportamiento:** El recepcionista solo envía `actual_balance` (efectivo contado). El backend calcula internamente `expected_balance` (fondo + ventas - egresos) y guarda la diferencia en auditoría, pero **no devuelve** esos datos en la respuesta si el rol es RECEPTIONIST: solo `200 OK` con `{ "message": "Turno cerrado exitosamente." }`.
- **UI:** En recepción no se muestra el "Saldo esperado" ni en la tarjeta de turno ni en el modal de cierre; solo el input de efectivo contado y un checkbox de confirmación. Admin/SuperAdmin sí ven el saldo esperado y la reconciliación al cerrar.

---

## 5. Tipos de egreso de caja

- **Categorías:** Cada egreso debe clasificarse en uno de: **SUPPLIER_PAYMENT** (pago a proveedores), **OPERATIONAL_EXPENSE** (gasto operativo del gym), **CASH_DROP** (retiro de efectivo por el dueño). Para los dos primeros la descripción es obligatoria (mín. 5 caracteres); para CASH_DROP es opcional.
- **Validación:** Backend y frontend exigen descripción cuando el tipo es SUPPLIER_PAYMENT u OPERATIONAL_EXPENSE.

---

## 6. Admin: controles adicionales

- **Forzar cierre:** En "Turnos abiertos (sin corte)" cada fila tiene un botón **"Forzar Cierre"** (solo Admin/SuperAdmin). Cierra el turno de forma forzada (ej. empleado salió sin corte). Auditoría: `SHIFT_FORCE_CLOSED`. Endpoint: `PATCH /api/v1/pos/shifts/:id/force-close`.
- **Personal (/admin/staff):** Listado de staff (usuarios con rol distinto de MEMBER). **Dar de baja** = soft delete (`deleted_at`). Usuarios inactivos: badge INACTIVO, sin acciones. Endpoint: `DELETE /api/v1/users/:id` (Admin/SuperAdmin).

---

## 7. Cerrar sesión y corte

- **Restricción:** Un recepcionista **no puede cerrar sesión** si tiene un turno abierto.
- **Comportamiento:** Al hacer clic en “Salir” en el layout de recepción:
  1. Se consulta si el usuario tiene turno abierto (`GET /pos/shifts/current`).
  2. Si **tiene turno abierto** → se muestra un modal: *“Tienes un turno de caja abierto. Debes hacer corte de caja antes de cerrar sesión…”* con botón **“Ir a cerrar turno”** (navega a `/reception`).
  3. Si **no** tiene turno abierto → se cierra sesión con normalidad.
- **Objetivo:** Asegurar que cada turno quede cerrado con su corte antes de que la persona salga, para no dejar turnos abiertos olvidados.

---

## 8. Resumen rápido (tabla)

| Pregunta | Respuesta |
|----------|-----------|
| ¿El admin ve ingresos de todos los turnos? | Sí: en Cortes de caja ve todos los turnos **cerrados** de todos los recepcionistas. |
| ¿No hacer corte afecta el stock? | No. El stock se actualiza al vender, no al cerrar turno. |
| ¿Afecta al turno del otro recep? | No. Cada recep tiene su turno; el stock es común y ya queda actualizado con cada venta. |
| ¿Se puede cerrar sesión sin hacer corte? | No. Si tiene turno abierto, se bloquea el logout hasta que haga corte (modal + “Ir a cerrar turno”). |

---

## 9. Referencia técnica (archivos)

- **Backend:** `shift.controller.ts` (open/close, **forceCloseShift**), `pos.controller.ts` (createSale descuenta stock en `$transaction`, **registerExpense** con tipo, getCurrentShift, getShifts, getOpenShifts). Cierre ciego: en `closeShift` se comprueba `req.userRole === RECEPTIONIST` y se responde solo `{ message }` sin reconciliación.
- **Frontend:** `ReceptionLayout.tsx` (bloqueo de logout + modal), `ReceptionPos.tsx` / `ReceptionCheckIn.tsx` (abrir/cerrar turno; **FormCloseShift** con `showExpectedBalance` según rol), **FormExpense** con select de tipo y validación de descripción, `AdminShifts.tsx` (historial + turnos abiertos + **Forzar Cierre**), `AdminStaffView.tsx` (personal, dar de baja).
- **Schema:** Enum `ExpenseType` (SUPPLIER_PAYMENT, OPERATIONAL_EXPENSE, CASH_DROP); modelo `Expense` con `type` y `description` opcional. Ver **DATABASE_SCHEMA.md** y **API_SPEC.md**.
