# Cambios recientes y roadmap

Documento de seguimiento de cambios implementados y pendientes del proyecto NexoGym.

---

## Cambios implementados

### Sesión reciente: permisos de recepcionista, ocupación y UI

| Área | Cambio |
|------|--------|
| **Analytics / Occupancy** | `GET /api/v1/analytics/occupancy` ahora usa `requireCanViewOccupancy`: permite Admin, SuperAdmin, rol RECEPTIONIST, o staff con `can_view_dashboard` o `can_use_reception`. Antes solo `can_view_dashboard`, lo que provocaba 403 en Check-in para recepcionistas. |
| **ReceptionLayout** | Agregados Clases y Rutinas al menú de recepción para staff con `can_use_routines` (si el módulo `classes` está activo). Rutas: `/reception/classes` y `/reception/routines` (se mantienen dentro del layout de recepción, no redirigen al panel admin). |
| **Panel admin link** | En ReceptionLayout, el link "Panel admin" se muestra a Admin/SuperAdmin o staff con `can_view_dashboard`. |
| **Modal de permisos** | Rediseñado: secciones "Módulos principales" y "Permisos adicionales", cada permiso con título + descripción corta, grid de 2 columnas en adicionales. Eliminada la fila redundante "Socios (recepción)". |
| **routes.config.ts** | Añadidas rutas `/reception/classes` y `/reception/routines` para breadcrumbs. |
| **App.tsx** | Añadidas rutas `<Route path="/reception/classes" element={<AdminClasses />} />` y `<Route path="/reception/routines" element={<AdminRoutines />} />` bajo ReceptionLayout. |

### Backend

| Archivo / Endpoint | Cambio |
|--------------------|--------|
| **user.controller.ts** | `getNextSaleFolio` en renovación; `receipt_folio` en la venta de renovación (formato V-YYYY-NNNNNN como ventas POS). |
| **shift.controller.ts** | Se devuelve `reconciliation` para todos los roles; eliminado el cierre ciego que ocultaba esperado/real/diferencia al RECEPTIONIST. |
| **analytics.controller.ts** | `getAuditLogs` con `from_date`, `to_date`, `userId`. |
| **pos.controller.ts** | `getShifts` con `from_date`, `to_date`, `user_id`. |
| **checkin.controller.ts** | `listVisits` con `staff_only`, `from_date`, `to_date`, `user_id`, paginación. Endpoint `GET /checkin/visits`. |

### Frontend

| Archivo | Cambio |
|---------|--------|
| **AdminMembers.tsx, ReceptionMembers.tsx** | Botón "Nuevo socio" en el header. |
| **ShiftForms.tsx** | Tras cerrar turno, muestra resumen (esperado, efectivo, diferencia, Cuadrado/Sobrante/Faltante) y botón "Listo". |
| **AdminShifts.tsx** | Paginación visible ("X de Y turnos"), filtros por fecha y cajero. |
| **AdminAudit.tsx** | Paginación visible, filtros por fecha, usuario y acción. |
| **AdminStaffAttendance.tsx** | Nueva vista: checadas del personal (solo Admin/SuperAdmin). Filtros por fecha y usuario. Tabla: fecha/hora, usuario, rol, método, tipo. |
| **apiClient.ts** | `CloseShiftResponse`, `fetchAuditLog` con `userId`, `from_date`, `to_date`; `fetchShifts` con `from_date`, `to_date`, `user_id`; `fetchVisits` con `staff_only`, `from_date`, `to_date`, `user_id`, paginación. |

### Rutas y navegación

| Ruta | Descripción |
|------|-------------|
| `/admin/attendance` | Asistencia de personal (Admin/SuperAdmin). Ítem de menú con `adminOnly: true`. |

### Documentación actualizada

| Documento | Cambios |
|-----------|---------|
| **UI_UX_GUIDELINES.md** | Pantalla "Asistencia de personal"; descripción de Cortes de caja con paginación y filtros. |
| **STAFF_QR_ACCESS_AND_ATTENDANCE.md** | Sección 4.3: vista Asistencia de personal (`/admin/attendance`) y API `GET /checkin/visits?staff_only=true`. |
| **CORTES_CAJA_Y_STOCK.md** | Resumen del corte al cerrar turno, cierre ciego eliminado. |
| **SUBSCRIPTION_EXPIRY_AND_RENEWAL.md** | Folio en venta por renovación (V-YYYY-NNNNNN). |
| **API_SPEC.md** | Endpoints de auditoría, turnos y visitas con filtros. |
| **DATABASE_SCHEMA.md** | ExpenseType REFUND, SUBSCRIPTION_CANCELED, etc. |

---

## Flujos documentados

### Cancelación con devolución

Cuando se devuelve dinero en otro turno: se registra egreso tipo REFUND; el turno donde se hace la devolución muestra el egreso en su corte. No genera faltante automático: el cajero debe cuadrar efectivo real vs esperado. Ver **CORTES_CAJA_Y_STOCK.md**.

### Check-in y auditoría

- **Socios:** Check-in registrado en Visit y en AuditLog como `CHECKIN_SUCCESS`.
- **Staff:** Check-in igual; vista **Asistencia de personal** filtra por `staff_only=true` para ver solo checadas del personal.
- **Auditoría:** Acciones críticas (incluida devolución/cancelación). Ver **INVENTARIO_AUDITORIA.md** y **AdminAudit**.

---

## Roadmap futuro

| Área | Pendiente |
|------|-----------|
| Asistencia | Exportar reporte de asistencia (CSV/Excel). |
| POS | Folio único global por gym (evitar duplicados en turnos simultáneos). |
| Turnos | Notificación al admin cuando un turno lleva muchas horas abierto. |
| Personal | Integrar checada con horario esperado (llegada tarde / salida anticipada). |
| UI | Refinamiento de mensajes n8n (plantillas de bienvenida, QR). |
| Tests | Aumentar cobertura de flujos de devolución y turnos. |

---

## Referencias rápidas

| Doc | Contenido |
|-----|-----------|
| **CORTES_CAJA_Y_STOCK.md** | Turnos, egresos, REFUND, cierre, resumen. |
| **SUBSCRIPTION_EXPIRY_AND_RENEWAL.md** | Renovación, folio de venta. |
| **STAFF_QR_ACCESS_AND_ATTENDANCE.md** | Checada staff, vista Asistencia de personal. |
| **API_SPEC.md** | Contratos de API. |
