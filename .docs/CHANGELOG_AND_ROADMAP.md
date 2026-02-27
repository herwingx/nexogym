# Cambios recientes y roadmap

Documento de seguimiento de cambios implementados y pendientes del proyecto NexoGym.

---

## Cambios implementados

### Integración Brevo para correos transaccionales

| Área | Cambio |
|------|--------|
| **email.service.ts** | Nuevo servicio que envía correos directamente a Brevo API. Reemplaza n8n para emails. |
| **Correos** | Bienvenida admin, bienvenida socio, reset staff→admin, comprobante renovación, comprobante venta POS. |
| **n8n** | Solo WhatsApp (welcome, staff_welcome, reward, shift_summary). |
| **Variables** | `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` en `.env`. |
| **Supabase Auth** | SMTP de Brevo configurado (variables `SMTP_*` en `.env` de Supabase Auth). Flujo "olvidé contraseña" operativo. |
| **Docs** | EMAIL_N8N_Y_DOMINIOS.md actualizado con Brevo como proveedor integrado. |

### Filtros de fecha: día actual por defecto

| Área | Cambio |
|------|--------|
| **Asistencia de personal** | Desde/Hasta por defecto = hoy. Evita cargar todos los días al abrir; los filtros permiten ver otros rangos. |
| **Cortes de caja** | Desde/Hasta por defecto = hoy. |
| **Auditoría** | Desde/Hasta por defecto = hoy. |
| **Visitas** | Fecha por defecto = hoy (ya estaba así). |

### Vista de visitantes por día (Admin y Recepción)

| Área | Cambio |
|------|--------|
| **VisitsPage** | Componente compartido: lista de visitas (socios + staff) por día. Selector de fecha, paginación (30 por página). Muestra nombre, rol, hora, método de acceso. |
| **Admin** | Ruta `/admin/visits` en menú lateral. Visible para Admin y staff con `can_use_reception`. |
| **Recepción** | Ruta `/reception/visits` en tabs. Accesible por recepcionista y quien tenga acceso a recepción. |
| **API** | Usa `GET /checkin/visits` con `from_date`, `to_date` (sin `staff_only` = incluye socios y staff). |
| **routes.config** | Breadcrumb para `/admin/visits` y `/reception/visits`. |

### Check-in biométrico: alineación con racha y last_checkin_date

| Área | Cambio |
|------|--------|
| **biometric.controller.ts** | Actualiza `last_checkin_date` en cada check-in (antes solo actualizaba `last_visit_at` y `current_streak`). Necesario para que el job streak-reset no resetee incorrectamente a socios que solo usan biométrico. |
| **biometric.controller.ts** | Misma lógica de racha que check-in QR: usa `last_checkin_date`, excepciones (gym reactivado, streak_freeze_until, días cerrados) y respeta `gamificationEnabled` (modules_config). |
| **FLUJO_CHECKIN_ASISTENCIA_RACHA.md** | Documento de revisión: flujo de escáner/asistencia/racha, qué estados se actualizan en cada check-in y comportamiento con varios socios. |

### Cron de reset de rachas

| Área | Cambio |
|------|--------|
| **streak-reset.job.ts** | Job diario que resetea `current_streak = 0` para socios cuyo `last_checkin_date` < ayer. Corre por gym (multitenant), respeta excepciones: streak_freeze_until, gym reactivado 7d, días cerrados. |
| **POST /api/v1/webhooks/streak-reset** | Webhook protegido por `CRON_WEBHOOK_SECRET` (header `x-cron-secret`). Ejecutar diario a las 00:05 UTC. |
| **RACHAS_CRON.md** | Documentación del job, configuración y zona horaria futura. |

### Auditoría responsiva y UX

| Área | Cambio |
|------|--------|
| **Fuente Inter** | Carga explícita en `index.css`; `font-family` actualizado. |
| **Safe area** | Clase `.pb-safe` en `index.css` para dispositivos con notch/home indicator; `MemberLayout` bottom nav. |
| **Tap targets 44px** | Button (size `touch`), ThemeToggle, nav items (AdminLayout, MemberLayout, ReceptionLayout), hamburger. |
| **ReceptionLayout** | Menú hamburguesa en móvil/tablet (tabs solo en desktop `lg+`). |
| **AdminLeaderboard / AdminRoutines** | `overflow-x-auto` en tablas para scroll horizontal en móvil. |
| **Tipografía** | Reemplazo de `text-[10px]`/`text-[11px]` por `text-xs` en varios componentes. |
| **Vite** | `host: true`, `allowedHosts: true` para acceso vía LAN y ngrok. |

### Permisos QR de socios (Ver y Regenerar)

| Área | Cambio |
|------|--------|
| **can_view_member_qr** | Permiso para ver el QR del socio en el detalle. Útil cuando el socio no lleva teléfono; recepción muestra el QR en pantalla para escanear. Admin puede activar en Personal → Permisos. |
| **can_regenerate_member_qr** | Permiso para regenerar el QR del socio (invalida el anterior). Admin puede delegar al staff cuando no está. |
| **GET /users/:id** (socio) | Devuelve `qr_payload` solo si el usuario tiene `can_view_member_qr` o es Admin/SuperAdmin. |
| **POST /users/:id/regenerate-qr** | Usa `requireCanRegenerateMemberQr`: Admin/SuperAdmin o staff con `can_regenerate_member_qr`. |
| **MemberDetailModal** | Muestra imagen del QR cuando la API devuelve `qr_payload`; botón Regenerar según permiso. |

### Check-in: mensaje distinto para congelado vs vencido

| Área | Cambio |
|------|--------|
| **Backend checkin.controller** | Devuelve `code: 'SUBSCRIPTION_FROZEN'` cuando la suscripción está congelada (el socio pausó su membresía y conserva días); `code: 'NO_ACTIVE_SUBSCRIPTION'` cuando está vencida, cancelada o sin suscripción. |
| **Frontend CheckInModal** | Muestra "Membresía congelada" (badge azul) con mensaje "Descongele para dar acceso" cuando es FROZEN; "Membresía vencida" (badge rojo) cuando es EXPIRED. |
| **Congelado** | Pausa voluntaria: el socio conserva sus días pero no puede entrar hasta descongelar. |
| **Vencido** | La fecha de vencimiento pasó; el socio debe renovar. |

### Check-in y gamificación

| Área | Cambio |
|------|--------|
| **Anti-passback 403** | Backend incluye `user` (name, profile_picture_url) en la respuesta 403 para mostrar datos del socio escaneado. |
| **CheckInModal antipassback** | Muestra foto y nombre del socio cuando el backend los envía. |
| **MemberRewards** | Foto de perfil del socio en la tarjeta de racha y en el ranking de racha. |

### Check-ins de hoy y Aforo (Recepción)

| Área | Cambio |
|------|--------|
| **ReceptionCheckIn** | "Check-ins de hoy": lista hasta 10 check-ins del día desde `GET /checkin/visits`. El primero destacado con foto, nombre, hora y racha (si aplica); el resto en lista compacta. **Aforo actual**: se muestra si el gym tiene Check-in QR (`qr_access`). |
| **Actualización tras escanear** | Tras cada check-in exitoso o cortesía, se refrescan **Check-ins de hoy** y **Aforo actual** sin recargar la página. |
| **checkin.controller.ts** | `listVisits` incluye `user_profile_picture_url` en cada item de la respuesta. |
| **apiClient** | `VisitRow` con campo opcional `user_profile_picture_url`. |

### POS: Escáner de cámara en móvil

| Área | Cambio |
|------|--------|
| **ReceptionPos** | Botón "Usar cámara" que abre el escáner de códigos de barras con la cámara del dispositivo. Modo continuo: permite escanear varios productos seguidos sin cerrar el modal. Pensado para móvil/tablet sin pistola USB. |
| **CameraScanner** | Un solo componente para QR (Check-in) y barcode (POS). Mismo componente en desktop (webcam) y móvil (cámara); solo cambia el modo (`qr` vs `barcode`). Ya soportaba ambos modos; ahora integrado en POS. |

### Notificaciones (Sileo)

| Área | Cambio |
|------|--------|
| **toast-override.css** | `[data-sileo-viewport] { z-index: 9999 !important }` para que los toasts queden por encima de los modales con backdrop-blur. |

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
| **checkin.controller.ts** | `listVisits` con `staff_only`, `from_date`, `to_date`, `user_id`, paginación. Incluye `user_profile_picture_url` por visita. Endpoint `GET /checkin/visits`. |

### Frontend

| Archivo | Cambio |
|---------|--------|
| **AdminMembers.tsx, ReceptionMembers.tsx** | Botón "Nuevo socio" en el header. |
| **ReceptionCheckIn.tsx** | "Check-ins de hoy": lista persistente desde API (no solo último en memoria). Fetch al cargar y tras cada check-in exitoso. |
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
| **API_SPEC.md** | Endpoints de auditoría, turnos y visitas con filtros; POST /webhooks/streak-reset; 403 antipassback con user; regenerate-qr con can_regenerate_member_qr. |
| **MEMBER_QR_ACCESS.md** | Permisos can_view_member_qr y can_regenerate_member_qr; flujo Ver QR en detalle del socio. |
| **RECEPTIONIST_PERMISSIONS_ANALYSIS.md** | Ver QR y Regenerar QR con permisos delegables. |
| **STAFF_PERMISSIONS_BY_ADMIN.md** | Permisos Ver QR de socios y Regenerar QR de socios. |
| **DATABASE_SCHEMA.md** | ExpenseType REFUND, SUBSCRIPTION_CANCELED, etc. |
| **RACHAS_CRON.md** | Cron de reset de rachas, zona horaria futura. |
| **SILEO_TOAST.md** | Override z-index para toasts sobre modales. |
| **DATABASE_SCHEMA.md** | Tabla `Promotion`, `Subscription.promotion_id`, productos INSCRIPTION/MEMBERSHIP_PAREJA/MEMBERSHIP_FAMILIAR. |
| **API_SPEC.md** | Endpoints `GET/POST/PATCH/GET /promotions` y `POST /pos/sales/promotion`. |
| **ESTRATEGIA_PROMOCIONES_E_INSCRIPCION.md** | Estrategia de promociones, inscripción, planes pareja/familiar. |

### Promociones e inscripción

| Área | Cambio |
|------|--------|
| **Schema Prisma** | Modelo `Promotion` (name, badge, type, pricing_mode, fixed_price, discount_percent, base_product_barcode, days, min/max_members, active, valid_from/until). `Subscription.promotion_id` opcional. Productos `INSCRIPTION`, `MEMBERSHIP_PAREJA`, `MEMBERSHIP_FAMILIAR`. |
| **Backend** | CRUD `/api/v1/promotions`. `POST /pos/sales/promotion` para venta con promo: integra Sale/SaleItem, turno, folio, crea/actualiza Subscriptions según tipo (INSCRIPTION, PLAN_PAREJA, PLAN_FAMILIAR). |
| **Admin** | Panel `/admin/promotions`: crear, editar, activar/desactivar promociones. |
| **Recepción / POS** | `PromoSaleModal`: selector de promo, participantes, cobro. Badge de promo en listados de socios (AdminMembers, ReceptionMembers). |
| **Seed** | Promociones de ejemplo por gym: Inscripción y Pareja (gymBasic, gymPro); Inscripción, Pareja 2x1 y Familiar (gymPremium). |
| **Inscripción en alta** | Al pagar un socio nuevo (PENDING_PAYMENT), `renewSubscription` detecta alta y cobra inscripción + membresía si hay promo INSCRIPTION activa. Promo inactiva = solo membresía. Sin cambios en el flujo ni deuda técnica. |

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
| **Rachas / timezone** | Soporte de `Gym.timezone` para que el cron de reset calcule "ayer" en la zona horaria de cada gym (relevante para SaaS con gyms en distintos países). |
| Asistencia | Exportar reporte de asistencia (CSV/Excel). |
| POS | Folio único global por gym (evitar duplicados en turnos simultáneos). |
| Turnos | Notificación al admin cuando un turno lleva muchas horas abierto. |
| Personal | Integrar checada con horario esperado (llegada tarde / salida anticipada). |
| UI | Refinamiento de mensajes n8n (plantillas de bienvenida, QR). |
| **Iconos animados** | Evaluar AnimateIcons o LivelyIcons (Lucide completo animado) vs Lucide + CSS. Ver **UI_UX_GUIDELINES.md** sección 10. |
| Tests | Aumentar cobertura de flujos de devolución y turnos. |

---

## Referencias rápidas

| Doc | Contenido |
|-----|-----------|
| **RACHAS_CRON.md** | Cron diario de reset de rachas, configuración, zona horaria futura. |
| **CORTES_CAJA_Y_STOCK.md** | Turnos, egresos, REFUND, cierre, resumen. |
| **SUBSCRIPTION_EXPIRY_AND_RENEWAL.md** | Renovación, folio de venta. |
| **STAFF_QR_ACCESS_AND_ATTENDANCE.md** | Checada staff, vista Asistencia de personal. |
| **API_SPEC.md** | Contratos de API. |
| **ESTRATEGIA_PROMOCIONES_E_INSCRIPCION.md** | Promociones, inscripción, planes pareja/familiar, templates, activar/desactivar, integración POS. |
