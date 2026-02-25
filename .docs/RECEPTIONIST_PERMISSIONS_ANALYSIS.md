# Análisis: Permisos del Recepcionista

Documento de referencia para decidir **qué sí** y **qué no** puede hacer el recepcionista, cuidando la integridad del negocio y teniendo en cuenta que **el admin no siempre está en el gym**.

---

## 1. Actividades típicas del recepcionista

| Actividad | Frecuencia | Dónde impacta en el sistema |
|-----------|------------|----------------------------|
| Registrar entrada de socios (QR / manual) | Constante | Check-in |
| Vender productos (agua, suplementos, merch) | Constante | POS / ventas |
| Cobrar y registrar egresos de caja | Diario | POS / turno / egresos |
| Abrir y cerrar turno de caja | Por turno | Shifts |
| **Dar de alta nuevos socios** | Cuando llega alguien nuevo | Users (crear) |
| **Registrar llegada de producto nuevo** | Cuando llega mercancía | Inventario (crear producto / restock) |
| Corregir datos del socio (nombre, teléfono) | Ocasional | Users (actualizar) |
| Consultar quién está dentro / listado de socios | Constante | Users (listar/buscar) |
| Renovar o congelar membresía | Según política del gym | Users (renew/freeze) |
| Dar “cortesía” (entrada sin membresía activa) | Excepcional | Check-in courtesy |
| Reportar merma (producto dañado/vencido) | Ocasional | Inventario (loss) |
| Ver reportes financieros / auditoría | No es su rol | Analytics / Audit |

---

## 2. Criterios para decidir SÍ / NO

- **Integridad:** Evitar fraude, manipulación de dinero o de datos sensibles (mermas, cortesías, eliminación de registros).
- **Auditoría:** Acciones sensibles deben quedar en AuditLog y, si aplica, solo admin puede autorizarlas.
- **Operación sin admin:** Si el admin no está, el recepcionista debe poder hacer lo **operativo** (altas, ventas, turno, productos nuevos), pero no lo **estratégico o de control** (reportes, mermas, cortesías, borrados).

---

## 3. Matriz recomendada: Recepcionista vs Admin

### Check-in y acceso

| Acción | Recepcionista | Admin | Notas |
|--------|----------------|-------|--------|
| Check-in normal (QR / manual) | ✅ Sí | ✅ Sí | Actividad core de recepción. |
| Cortesía (entrada sin membresía activa) | ❌ No | ✅ Sí | Riesgo de abuso; debe quedar en auditoría y solo admin. |

### Caja y POS

| Acción | Recepcionista | Admin | Notas |
|--------|----------------|-------|--------|
| Abrir turno (fondo inicial) | ✅ Sí | ✅ Sí | Operación de caja diaria. |
| Cerrar turno (corte con saldo real) | ✅ Sí | ✅ Sí | **Cierre ciego:** recepcionista no ve saldo esperado; solo ingresa efectivo contado. Backend no devuelve reconciliación si rol RECEPTIONIST; AuditLog sí registra todo. |
| Registrar venta POS | ✅ Sí | ✅ Sí | Core del rol. |
| Registrar egreso de caja | ✅ Sí | ✅ Sí | **Egresos tipados:** tipo obligatorio (SUPPLIER_PAYMENT, OPERATIONAL_EXPENSE, CASH_DROP); descripción obligatoria para los dos primeros (mín. 5 caracteres). |
| Ver historial de turnos (cortes) | ⚠️ Opcional | ✅ Sí | Recepción podría ver solo “su” turno; historial completo suele ser admin. |
| Forzar cierre de turno ajeno | ❌ No | ✅ Sí | Solo Admin/SuperAdmin (Cortes de caja → Turnos abiertos → Forzar Cierre). |

### Socios (CRM)

| Acción | Recepcionista | Admin | Notas |
|--------|----------------|-------|--------|
| **Alta de nuevo socio** | ✅ Sí | ✅ Sí | Necesario cuando admin no está; alta con nombre, teléfono, PIN. |
| **Editar nombre / teléfono del socio** | ✅ Sí | ✅ Sí | Correcciones de datos sin tocar suscripción. |
| Reenviar QR por WhatsApp | ✅ Sí | ✅ Sí | Mismo código; útil si el socio borró el chat. |
| Regenerar QR (invalida el anterior) | ❌ No | ✅ Sí | Solo admin; por fraude o pérdida de control. |
| Listar / buscar socios | ✅ Sí | ✅ Sí | Para consultas y check-in manual. |
| Renovar suscripción (días) | ⚠️ Recomendado Sí | ✅ Sí | Operación de ventanilla; puede limitarse a “X días” sin cambiar planes. |
| Congelar / descongelar | ⚠️ Recomendado Sí | ✅ Sí | Muy operativo; el admin define política. |
| Cancelar suscripción | ⚠️ Opcional | ✅ Sí | Según política: a veces solo admin. |
| Soft-delete (dar de baja socio) | ❌ No | ✅ Sí | Evitar borrados por recepción; integridad. |
| Exportar datos / anonimizar (GDPR) | ❌ No | ✅ Sí | Solo admin por privacidad y responsabilidad legal. |

### Inventario

| Acción | Recepcionista | Admin | Notas |
|--------|----------------|-------|--------|
| **Ver productos y stock** | ✅ Sí | ✅ Sí | Necesario para POS y para saber qué hay. |
| **Alta de producto nuevo** | ✅ Sí | ✅ Sí | Cuando llega producto y admin no está. |
| **Restock (entrada de cantidad)** | ✅ Sí | ✅ Sí | Operación de recepción de mercancía. |
| Editar nombre / precio / código | ⚠️ Opcional | ✅ Sí | Recepción podría solo “alta + restock”; ediciones sensibles para admin. |
| **Registrar merma** | ❌ No | ✅ Sí | Sensible a fraude; obligatorio motivo + AuditLog; solo admin. |
| Eliminar producto (soft delete) | ❌ No | ✅ Sí | Evitar borrados por recepción. |

### Clases, rutinas, analytics, SaaS

| Acción | Recepcionista | Admin | Notas |
|--------|----------------|-------|--------|
| Crear / editar / eliminar clases | ❌ No | ✅ Sí | Configuración del gym. |
| Ver rutinas de un socio | ❌ No | ✅ Sí (o instructor) | No es rol de recepción. |
| Crear / editar rutinas | ❌ No | ✅ Sí (o instructor) | Idem. |
| Ver ocupación en vivo | ⚠️ Opcional | ✅ Sí | Útil en recepción para “cuántos hay”; no obligatorio. |
| Reporte financiero (mensual) | ❌ No | ✅ Sí | Solo admin. |
| Ingresos del día | ⚠️ Opcional | ✅ Sí | Si quieren mostrar “ventas de hoy” en recepción, se puede. |
| Auditoría (AuditLog) | ❌ No | ✅ Sí | Control y anti-fraude; solo admin. |
| Comisiones | ❌ No | ✅ Sí | Datos sensibles de nómina. |
| Cualquier ruta `/saas/*` | ❌ No | ❌ No (solo SuperAdmin) | Fuera de alcance. |

---

## 4. Estado del backend (implementado)

- **Check-in:** Cualquier usuario autenticado puede hacer check-in; cortesía solo ADMIN (controlador).
- **POS / turnos / egresos:** `requireAuth` + módulo `pos` → recepcionista y admin pueden.
- **Inventario:** `requireAuth` + módulo `pos` para todo. **Merma** (`POST /inventory/loss`) y **eliminar producto** (`DELETE /inventory/products/:id`) usan `requireAdminOrSuperAdmin` → solo admin. Recepcionista puede: listar, crear producto, restock, editar producto, ver transacciones.
- **Users:** `requireStaff` (Admin **o** Recepcionista o SuperAdmin) en: `GET /users`, `GET /users/search`, `POST /users`, `PATCH /users/:id` → recepcionista puede listar, buscar, alta y editar nombre/teléfono. Delete, renew, freeze, unfreeze, cancel, export, anonymize, sync-expired siguen con `requireAdminOrSuperAdmin`.
- **Analytics:** `requireAuth` para ocupación e ingresos del día. **Reporte financiero**, **auditoría** y **comisiones** usan `requireAdminOrSuperAdmin` → solo admin.

---

## 5. Resumen ejecutivo

- **Recepcionista debe poder (aunque el admin no esté):**  
  Check-in, POS (ventas + egresos), abrir/cerrar turno, **alta de socios**, **editar nombre/teléfono**, **alta de productos** y **restock**. Opcionalmente: renovar/congelar membresía, ver ocupación o ingresos del día.
- **Recepcionista no debe poder (integridad):**  
  Cortesía, **merma de inventario**, eliminar socios/productos, ver auditoría, reportes financieros o comisiones, export/anonymize, y cualquier cosa en `/saas/*`.

Con esto se cubre la operación diaria cuando el admin no está y se mantiene un límite claro para proteger integridad y auditoría.

---

## 6. Qué falta (si aplica) y por qué

| Qué revisar | Dónde | Por qué |
|-------------|--------|--------|
| **UI no debe mostrar acciones que el backend deniega al recepcionista** | Frontend: botones/links de merma, eliminar producto, eliminar socio, auditoría, reporte financiero, comisiones | El backend ya devuelve 403 si un recepcionista intenta esas acciones. La UI debe ocultar o deshabilitar esos controles para recepcionista (mejor UX y menos confusión). Si la UI los muestra, el usuario verá error al usarlos; no es fallo de seguridad, pero conviene revisar que el menú y las pantallas reflejen la matriz de este doc. |
| **Cortesía (entrada sin membresía)** | Solo admin en backend; en frontend solo el rol admin debe ver la opción | Idem: consistencia UI ↔ permisos. |
| **Nada “falta” en backend** para el rol recepcionista según esta matriz | — | La sección 4 describe lo ya implementado; si en el futuro se amplía lo que puede hacer recepción, habría que actualizar middlewares y este doc. |
