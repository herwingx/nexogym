# Revisión frontend ↔ backend — POS, turnos, egresos y personal

## Checklist de conexión

### 1. API Base
- **Frontend:** `VITE_API_BASE_URL` o `/api/v1` → `fetchWithAuth(path)` arma `GET/POST/PATCH/DELETE` correctos.
- **Backend:** Rutas bajo `/api/v1/pos` y `/api/v1/users`. ✅ Coinciden.

### 2. Egresos (FormExpense)
| Frontend | Backend | Estado |
|----------|---------|--------|
| `POST /pos/expenses` con `{ amount, type, description? }` | `expenseSchema`: amount, type (enum), description opcional; refine: descripción obligatoria (≥5 chars) para SUPPLIER_PAYMENT y OPERATIONAL_EXPENSE | ✅ |
| No envía `description` cuando está vacía (CASH_DROP) | Zod `description` opcional; Prisma `description?: string \| null` | ✅ |
| Select: SUPPLIER_PAYMENT, OPERATIONAL_EXPENSE, CASH_DROP | Enum `ExpenseType` en schema y Prisma | ✅ |

### 3. Cierre de turno (FormCloseShift)
| Frontend | Backend | Estado |
|----------|---------|--------|
| `POST /pos/shifts/close` con `{ actual_balance: number }` | `actual_balance` requerido; usa `Number(actual_balance)` | ✅ |
| Input efectivo: formato moneda (comas miles), parseo con `replace(/,/g,'')` antes de enviar | Acepta número (string numérico se convierte con `Number()`) | ✅ |
| RECEPTIONIST: no ve "Saldo esperado" en modal ni en tarjeta (POS / Recepción) | Cierre ciego: respuesta 200 con solo `{ message }` para RECEPTIONIST | ✅ |
| Checkbox obligatorio + sileo.success al cerrar | — | ✅ |

### 4. Force Close (AdminShifts)
| Frontend | Backend | Estado |
|----------|---------|--------|
| `PATCH /pos/shifts/:id/force-close` con `{ actual_balance: 0 }` | `requireAdminOrSuperAdmin`; body opcional `actual_balance` (default 0) | ✅ |
| Modal de confirmación → recarga lista abiertos y cerrados | 200 + auditoría SHIFT_FORCE_CLOSED | ✅ |

### 5. Personal (AdminStaffView)
| Frontend | Backend | Estado |
|----------|---------|--------|
| `GET /users?page=&limit=&role_not=MEMBER` | `getUsers` con `role_not=MEMBER`; devuelve `deleted_at` | ✅ |
| `DELETE /users/:id` para "Dar de baja" | Soft delete (`deleted_at = now()`) | ✅ |
| Badge INACTIVO si `deleted_at != null`; sin acciones | Listado incluye inactivos; UI oculta acciones | ✅ |
| Modal de confirmación antes de dar de baja | — | ✅ |

### 6. Rutas y navegación
- `/admin/staff` → `AdminStaffView` en `App.tsx`. ✅
- AdminLayout: enlace "Personal" (UserCog) a `/admin/staff`. ✅

### 7. Otras comprobaciones
- **Ventas POS:** `POST /pos/sales` con `items`; backend descuenta stock en la misma transacción. Sin cambios. ✅
- **GET /pos/shifts/current:** Sigue devolviendo `expected_balance`; solo se oculta en UI para RECEPTIONIST. ✅

### 8. Turnos abiertos (Admin) y bloqueo de logout
| Frontend | Backend | Estado |
|----------|---------|--------|
| **GET /pos/shifts/open** (AdminShifts) | `getOpenShifts`; `requireAdminOrSuperAdmin`; lista turnos OPEN del gym | ✅ |
| Sección "Turnos abiertos (sin corte)" en Cortes de caja | Muestra recepcionistas con turno abierto (nombre, hora, fondo) | ✅ |
| **ReceptionLayout** — clic "Salir" | Si `fetchCurrentShift()` devuelve turno OPEN → modal "Debes cerrar turno…" con "Ir a cerrar turno" (navega a `/reception`); no se cierra sesión hasta hacer corte | ✅ |

---

## Correcciones aplicadas en esta revisión

1. **Cierre ciego:** Ocultar "Esperado" también en la tarjeta de turno (ReceptionPos y ReceptionCheckIn) cuando `user?.role === 'RECEPTIONIST'`.
2. **Input efectivo (FormCloseShift):** Parseo correcto de montos con comas (miles): se eliminan comas y se permite un solo punto decimal antes de formatear.
3. **Egresos:** No enviar `description` en el body cuando está vacía (CASH_DROP), para cumplir con `description` opcional en backend (Zod `min(1)` si se envía).
4. **Dar de baja:** Modal de confirmación antes de llamar a `DELETE /users/:id`.

---

## Cómo probar antes de producción

1. **Recepción (RECEPTIONIST):**
   - Abrir turno, hacer venta, registrar egreso (elegir tipo y, si aplica, descripción).
   - En tarjeta de turno no debe verse "Esperado".
   - Cerrar turno: solo input de efectivo + checkbox; no debe verse saldo esperado; al enviar, toast de éxito.
2. **Admin:**
   - En Cortes de caja: ver turnos abiertos, pulsar "Forzar Cierre", confirmar; verificar que el turno pase a cerrado.
   - En Personal: listar staff, dar de baja a uno, confirmar en modal; verificar badge INACTIVO y que no tenga "Dar de baja".
3. **Base de datos:** Ejecutar `npx prisma db push` (o migración equivalente) para aplicar enum `ExpenseType` y campo `type` en `Expense` si aún no está aplicado.

---

## Documentación relacionada

- **.docs/CORTES_CAJA_Y_STOCK.md** — Modelo de turnos, stock (actualización en venta), bloqueo de logout si turno abierto, vista admin.
- **.docs/EMAIL_POLITICA_GYM.md** — Uso de correos corporativos del gym para staff y reasignación al dar de baja.
