# Revisión por roles: frontend vs backend

## Resumen de roles y acceso

| Rol          | Backend (permisos) | Frontend (rutas) | ¿Consistente? |
|-------------|--------------------|-------------------|----------------|
| **SUPERADMIN** | `/saas/*`, todo lo que tenga requireAuth | `/saas` (SuperAdminDashboard) | ✅ |
| **ADMIN**     | requireAdminOrSuperAdmin + requireStaff; check-in (requireStaff) | AdminRoute → /admin/*; sidebar incluye "Check-in" → /reception | ✅ |
| **RECEPTIONIST** | requireStaff (users, checkin); POS con cierre ciego | ReceptionRoute → /reception/* | ✅ |
| **COACH**      | requireCoachOrAdmin (rutinas, markAttendance) | **Antes:** sin ruta (caía en /admin y bloqueado). **Ahora:** AdminRoute con menú limitado (Clases, Rutinas) | ✅ (corregido) |
| **INSTRUCTOR** | requireCoachOrAdmin (rutinas, markAttendance) — incluido desde 2025-02-25 | AdminRoute con menú limitado (Clases, Rutinas) | ✅ |
| **MEMBER**     | Solo `/members/*` | MemberRoute → /member/* | ✅ |

---

## Detalle por área

### 1. Admin (ADMIN / SUPERADMIN)

| Vista / API | Backend | Frontend | Notas |
|-------------|---------|----------|--------|
| GET /users (socios) | requireStaff | AdminMembers y ReceptionMembers → fetchMemberUsers, searchMembers | ✅ Listado paginado, búsqueda, orden por nombre |
| GET /users?role_not=MEMBER (staff) | requireStaff | AdminStaffView → fetchStaffUsers | ✅ |
| DELETE /users/:id | requireAdminOrSuperAdmin | AdminStaffView → deleteUser | ✅ |
| renew, freeze, unfreeze, cancel-subscription | requireAdminOrSuperAdmin (cancel); renew/freeze/unfreeze = requireStaff en backend | apiClient + vistas Socios (Admin y Recepción); Cancelar solo en Admin | ✅ |
| GET /users/:id/data-export, POST anonymize | requireAdminOrSuperAdmin | No en UI (apiClient puede tenerlas) | ⚠️ Opcional / GDPR |
| Cortes de caja, Force close | requireAdminOrSuperAdmin / requireStaff | AdminShifts | ✅ |
| POS (productos, ventas, egresos, turnos) | requireAuth + requireStaff + módulo pos | ReceptionPos (recepción o admin) | ✅ |
| Inventario | requireAuth + requireStaff + módulo pos; delete/loss = requireAdminOrSuperAdmin | AdminInventory | ✅ |
| Finanzas, Auditoría | requireAdminOrSuperAdmin | AdminFinance, AdminAudit | ✅ |
| Clases (listar, crear reserva) | requireAuth / requireAdminOrSuperAdmin (crear clase) | AdminClasses | ✅ |
| Rutinas | requireCoachOrAdmin | AdminRoutines | ✅ |
| GET/PATCH /gym/rewards-config (premios por racha) | requireAdminOrSuperAdmin + requireModuleEnabled('gamification') | AdminRewards (/admin/rewards), visible solo si módulo gamification | ✅ |

### 2. Recepción (RECEPTIONIST / ADMIN / SUPERADMIN)

| Vista / API | Backend | Frontend | Notas |
|-------------|---------|----------|--------|
| Check-in, cortesía | requireStaff + requireAuth; courtesy = ADMIN only (controller) | ReceptionCheckIn. El admin tiene enlace "Check-in" en el sidebar de /admin que lleva a /reception. | ✅ Regenerate QR solo si canRegenerateQr (ADMIN/SUPERADMIN) |
| POS, egresos, cierre ciego | requireAuth + requireStaff + módulo pos | ReceptionPos, ShiftForms | ✅ |
| Buscar/editar socios, enviar QR | requireStaff | ReceptionMembers | ✅ |
| Regenerar QR | requireAdminOrSuperAdmin | Solo visible si canRegenerateQr | ✅ |

### 3. Socio (MEMBER)

| Vista / API | Backend | Frontend | Notas |
|-------------|---------|----------|--------|
| /members/me, history, send-qr | Solo MEMBER | MemberHome, MemberHistory, MemberRewards (premios por racha, streak_rewards), etc. | ✅ |

### 4. COACH

- Backend: puede usar rutinas (list, create, update, delete, exercises) y PATCH booking attend.
- Frontend (tras corrección): puede entrar a /admin; en el menú solo ve **Clases** y **Rutinas**. defaultPath para COACH → `/admin/routines`. Si accede a `/admin`, AdminDashboard redirige a `/admin/routines`.

### 5. INSTRUCTOR

- Backend: **incluido** en requireCoachOrAdmin (2025-02-25). Puede usar rutinas (list, create, update, delete, exercises) y PATCH booking attend.
- Frontend: puede entrar a /admin con el mismo menú limitado que COACH (Clases, Rutinas) y defaultPath → `/admin/routines`.

---

## Gaps e inconsistencias

1. **Admin Members (Socios)** — **Resuelto (2025-02-26)**  
   - Vista conectada a GET /users?role=MEMBER (fetchMemberUsers), paginación 20 por página, búsqueda, columna Vence, resumen por vencer/vencidos.  
   - Acciones renovar, congelar, descongelar en Admin y Recepción; **solo Admin:** cancelar suscripción y regenerar QR.  
   - Formulario de edición de socio (nombre, teléfono, foto, reenviar QR) compartido en `EditMemberForm`; Admin muestra además Regenerar QR.  
   - Coherencia de funcionalidades y vista entre Admin y Recepción según RECEPTIONIST_PERMISSIONS_ANALYSIS.md.

2. **COACH**  
   - **Corregido:** Ahora puede acceder a /admin con menú limitado (Clases, Rutinas) y defaultPath → /admin/routines.

3. **INSTRUCTOR**  
   - **Resuelto (2025-02-25):** Incluido en requireCoachOrAdmin. Mismo menú limitado que COACH en front.

4. **apiClient**  
   - **Resuelto:** renewSubscription, freezeSubscription, unfreezeSubscription, cancelSubscription implementados y usados en AdminMembers y ReceptionMembers. exportUserData / anonymizeUserData siguen opcionales para GDPR si se requieren en UI.

---

## Checklist rápida por rol

- **SUPERADMIN:** /saas, métricas, gimnasios, tier, módulos. ✅  
- **ADMIN:** Dashboard, **Check-in** (enlace a /reception), Socios (API real, búsqueda, paginación, editar, renovar/congelar/descongelar/cancelar, regenerar QR), Finanzas, Inventario, Cortes, Personal, Clases, Rutinas, Auditoría. ✅  
- **RECEPTIONIST:** Check-in, POS, Cierre ciego, Egresos tipados, Buscar/editar socios, Enviar QR. ✅ Regenerar QR oculto.  
- **COACH:** Solo Clases y Rutinas en /admin. ✅  
- **INSTRUCTOR:** Solo Clases y Rutinas en /admin (igual que COACH). ✅  
- **MEMBER:** Portal socio (perfil, historial, recompensas, QR). ✅  
