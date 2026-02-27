# Índice de documentación

Referencia rápida de los documentos en `.docs/` y cómo encajan entre sí.

---

## Marketing y landing

| Documento | Contenido |
|-----------|-----------|
| **CONTEXTO_MARKETING_LANDING.md** | Contexto de producto para el sitio de marketing y landing: funcionalidades, planes, beneficios, headlines y mensajes clave. |

---

## Arquitectura y producto

| Documento | Contenido |
|-----------|-----------|
| **ARCHITECTURE.md** | Visión general del sistema, capas, multitenancy. |
| **ARCHITECTURE_REVIEW_NEXOGYM.md** | Revisión de arquitectura del producto. |
| **DOMINIO_Y_URL_PRODUCCION.md** | Dominio, URL y marca en producción: arquitectura recomendada, white-label, opciones futuras (subdominios, dominios propios). |
| **PRD.md** | Product Requirements Document. |
| **DATABASE_SCHEMA.md** | Modelo de datos Prisma: enums, tablas, acciones auditadas. Incluye **ExpenseType** (REFUND para reembolsos), **Expense**, **CashShift** (expected_balance), **SHIFT_CLOSED** / **SHIFT_FORCE_CLOSED** / **SUBSCRIPTION_CANCELED** / **USER_SOFT_DELETED**. |

---

## API y contratos

| Documento | Contenido |
|-----------|-----------|
| **API_SPEC.md** | Contratos de la API por sprint: check-in, POS, turnos, users, members, bookings, routines, SaaS, webhooks. Incluye **cierre ciego** (POST /pos/shifts/close), **force-close**, **POST /pos/expenses** (tipos), **POST /webhooks/streak-reset**, **GET /users?role_not=MEMBER**, **DELETE /users/:id**, **GET/PATCH /gym/rewards-config** (premios por racha). |
| **GAMIFICACION_PREMIOS_RACHA.md** | Gamificación: configuración de premios por racha por gym (admin), formato `rewards_config.streak_rewards`, portal socio (participación por racha, hitos), check-in y n8n. |
| **RACHAS_CRON.md** | Cron diario de reset de rachas: webhook streak-reset, configuración, zona horaria futura. |
| **ACCESO_PORTAL_SOCIOS.md** | Acceso al portal de socios por **email + contraseña** (no por número). Alta con email obligatorio cuando el gym tiene portal; contraseña temporal por correo y cambio en el primer login. |

---

## Caja, turnos y stock

| Documento | Contenido |
|-----------|-----------|
| **CORTES_CAJA_Y_STOCK.md** | Flujo de turnos, stock al vender, **cierre ciego** (recepcionista no ve saldo esperado), **tipos de egreso** (SUPPLIER_PAYMENT, OPERATIONAL_EXPENSE, CASH_DROP, REFUND para reembolsos), **Forzar Cierre** y **Personal** (/admin/staff). Secciones 4–9: cierre ciego, tipos de egreso, controles admin, cerrar sesión, resumen, referencia técnica. |
---

## Auth y Supabase

| Documento | Contenido |
|-----------|-----------|
| **SUPABASE_AUTH_EN_EL_PROYECTO.md** | Cómo interactúa Supabase Auth con el proyecto: flujo login → token → backend, enlace `auth_user_id`, ventajas frente a implementar login propio, variables de entorno. |
| **SUPABASE_STORAGE_BUCKETS.md** | Buckets `gym-logos` y `profile-pictures`: crear buckets públicos, políticas (INSERT para authenticated), errores frecuentes y checklist por entorno. |
| **BOOTSTRAP_PRODUCCION_PRIMER_ADMIN.md** | Primer arranque con DB vacía en producción: **bootstrap-superadmin** (recomendado), seed para desarrollo, cómo crear SuperAdmin y admin de un gym. Incluye funcionamiento del script y checklist. |
| **CANALES_COMUNICACION.md** | Email vs WhatsApp: bienvenida (credenciales), reset contraseña, QR, cumpleaños. Staff: admin resetea, nueva contraseña al correo del admin. |
| **EMAIL_N8N_Y_DOMINIOS.md** | Setup Brevo (correos transaccionales), variables `BREVO_*`, setup rápido sin dominio (Gmail), Supabase SMTP para "olvidé contraseña", estimación de volumen, CRM/soporte, checklist. |

---

## Roles, permisos y usuarios

| Documento | Contenido |
|-----------|-----------|
| **SEED_USERS_AND_ROLES.md** | Roles (SUPERADMIN, ADMIN, RECEPTIONIST, **COACH**, **INSTRUCTOR**, MEMBER), planes, credenciales de seed, **tabla qué SÍ/NO por rol**, checklist de verificación y datos para flujos (QR, leaderboard, auditoría, COACH). |
| **STAFF_QR_ACCESS_AND_ATTENDANCE.md** | Acceso QR y checada del staff: creación con QR, bienvenida WhatsApp, baja/reactivación, vista detalle tipo socios, flujo de checada (recepción vs autónomo). |
| **RECEPTIONIST_PERMISSIONS_ANALYSIS.md** | Matriz Recepcionista vs Admin: check-in, caja (cierre ciego, egresos tipados, forzar cierre), socios, inventario. |
| **REVISION_ROLES_FRONTEND_BACKEND.md** | Revisión por rol: qué puede hacer cada uno en frontend y backend, checklist. Admin/Recepción Socios alineados (2025-02-26). INSTRUCTOR en requireCoachOrAdmin. |
| **REVISION_ROLES_FINAL.md** | Matriz RBAC completa, gaps de seguridad resueltos (check-in requireStaff, POS/Inventory requireStaff), changelog de seguridad. |

---

## Frontend e integración

| Documento | Contenido |
|-----------|-----------|
| **FRONTEND_INTEGRATION.md** | Integración frontend con la API. |
| **REVISION_FRONTEND_POS_Y_STAFF.md** | Revisión frontend ↔ backend: egresos, cierre ciego, force close, personal; correcciones aplicadas (ocultar “Esperado”, parseo efectivo, confirmación dar de baja). |
| **UI_UX_GUIDELINES.md** | Guías de UI/UX del proyecto. |
| **PWA_MANIFEST_DINAMICO.md** | PWA: manifest dinámico por gym (nombre y theme al instalar la app; cookie en /users/me/context). |
| **SILEO_TOAST.md** | Uso de toasts (Sileo) en la app. |
| **SKELETONS.md** | Componentes de carga (skeletons). |

---

## Suscripciones, billing y seguridad

| Documento | Contenido |
|-----------|-----------|
| **SUBSCRIPTION_EXPIRY_AND_RENEWAL.md** | Vencimiento y renovación de suscripciones. |
| **REFACTOR_BILLING_RBAC_CHECKIN.md** | Refactor de billing, RBAC y check-in. |
| **FRONTEND_SECURITY_AUDIT.md** | Auditoría de seguridad frontend. |
| **SECURITY_HEADERS.md** | Headers de seguridad. |

---

## Cambios y roadmap

| Documento | Contenido |
|-----------|-----------|
| **CHANGELOG_AND_ROADMAP.md** | Cambios implementados (backend, frontend, docs), flujos documentados (cancelación con devolución, check-in y auditoría), roadmap futuro. |

---

## Otros

| Documento | Contenido |
|-----------|-----------|
| **DOCUMENTACION_USUARIO_BASE.md** | Base para manual de usuario: funcionalidades por rol, planes, flujos clave (renovación, turnos, inventario). Punto de partida para documentación de usuario. |
| **MEMBER_QR_ACCESS.md** | Acceso del socio por QR. |
| **EMAIL_POLITICA_GYM.md** | Política de email del gym. |
| **TESTING_STRATEGY.md** | Estrategia de pruebas. |
| **DEV_WORKFLOW.md** | Flujo de desarrollo. |
| **GO_LIVE_CHECKLIST.md** | Checklist para puesta en producción. |
| **BRANCH_PROTECTION.md** | Protección de ramas. |
| **FRONTEND_BACKEND_COVERAGE.md** | Cobertura frontend/backend. |

---

## Cambios recientes (POS, caja, personal, roles, renovación, Basic)

- **Renovación con precio del producto:** Admin configura el producto "Membresía 30 días" (barcode MEMBERSHIP) en Inventario; Reception/Coach solo renuevan sin input manual de monto (evita manipulación). Si el producto no existe, error claro pidiendo al Admin crearlo.
- **Inventario:** Crear/editar productos (incl. precios) solo Admin; Reception/Coach solo venden al precio del catálogo.
- **Plan BASIC — Socios sin portal:** Miembros en plan Basic no tienen acceso al portal (QR, premios, historial); ven pantalla de bloqueo y pueden cerrar sesión.
- **Ocupación / aforo:** El semáforo de ocupación en Dashboard admin y el bloque "Aforo actual" en Check-in (recepción) **solo se muestran cuando el gym tiene Check-in QR** (`qr_access`). En plan Basic el front no llama a `/api/v1/analytics/occupancy`; el admin ve solo Ventas del mes y Ganancia neta.
- **Inputs turno:** Corregida la edición en Abrir turno (fondo inicial) y Cerrar turno (efectivo contado); HardwareScanner no roba foco cuando modales de turno están abiertos.
- **Check-in por cámara:** Botón "Usar cámara" en recepción permite escanear el QR del socio con la cámara del dispositivo (móvil, tablet o PC) cuando no hay pistola USB.
- **POS por cámara:** Botón "Usar cámara" en POS permite escanear códigos de barras de productos con la cámara (móvil, tablet o PC). Mismo componente `CameraScanner` que Check-in; solo cambia el modo (qr vs barcode).
- **Cierre ciego:** Recepcionista no ve saldo esperado; solo envía efectivo contado; backend no devuelve reconciliación si rol RECEPTIONIST.
- **Tipos de egreso:** SUPPLIER_PAYMENT, OPERATIONAL_EXPENSE, CASH_DROP; descripción obligatoria para los dos primeros.
- **Forzar cierre:** Admin puede cerrar un turno abierto desde Cortes de caja (PATCH /pos/shifts/:id/force-close).
- **Personal (/admin/staff):** Listado de staff (role_not=MEMBER), dar de baja (soft delete), badge INACTIVO.
- **COACH / INSTRUCTOR:** Acceso a /admin con menú limitado (solo Clases y Rutinas); defaultPath /admin/routines; AdminDashboard redirige a rutinas si el rol es COACH o INSTRUCTOR.
- **Menú por módulo:** Clases y Rutinas solo se muestran si `modules_config.classes === true`; **Gamificación** (premios por racha) solo si `gamification === true` (`/admin/rewards`). Inventario y Cortes solo si `pos === true`. Acceso directo por URL redirige o muestra mensaje según el módulo. Breadcrumbs y botón "Volver" en layouts.
- **Admin móvil:** Menú hamburguesa y drawer en pantallas pequeñas.
- **Layouts:** Padding `p-4 sm:p-6` en AdminLayout y ReceptionLayout para que todas las vistas (Admin, Coach, Recepción) tengan márgenes consistentes. Theme toggle siempre en header (no en sidebar).
- **Leaderboard:** Ruta `/admin/leaderboard` y `/reception/leaderboard` para staff con permiso `can_view_leaderboard`. Búsqueda por nombre y paginación (como Socios). Mensajes de error amigables (sin detalles técnicos en producción). Ver **UI_UX_GUIDELINES.md**.
- **PWA manifest dinámico (white-label):** Al instalar la app, el usuario ve el **nombre del gym** (y theme_color) en lugar de "NexoGym". GET /api/v1/manifest devuelve el manifest personalizado usando la cookie `nexogym_gym_id` seteada en /users/me/context. Ver **PWA_MANIFEST_DINAMICO.md**.

Para más detalle técnico: **CORTES_CAJA_Y_STOCK.md**, **API_SPEC.md**, **REVISION_ROLES_FRONTEND_BACKEND.md**, **REVISION_FRONTEND_POS_Y_STAFF.md**, **SUBSCRIPTION_EXPIRY_AND_RENEWAL.md**.

- **Asistencia de personal:** Vista `/admin/attendance` (solo Admin/SuperAdmin). Checadas del staff con filtros por fecha y usuario. Ver **CHANGELOG_AND_ROADMAP.md**, **STAFF_QR_ACCESS_AND_ATTENDANCE.md**.
