# Revisión por roles: frontend vs backend

## Resumen de roles y acceso

| Rol          | Backend (permisos) | Frontend (rutas) | ¿Consistente? |
|-------------|--------------------|-------------------|----------------|
| **SUPERADMIN** | `/saas/*`, todo lo que tenga requireAuth | `/saas` (SuperAdminDashboard) | ✅ |
| **ADMIN**     | requireAdminOrSuperAdmin + requireStaff | AdminRoute → /admin/* | ✅ |
| **RECEPTIONIST** | requireStaff (users, checkin); POS con cierre ciego | ReceptionRoute → /reception/* | ✅ |
| **COACH**      | requireCoachOrAdmin (rutinas, markAttendance) | **Antes:** sin ruta (caía en /admin y bloqueado). **Ahora:** AdminRoute con menú limitado (Clases, Rutinas) | ✅ (corregido) |
| **INSTRUCTOR** | No está en requireCoachOrAdmin; solo existe en modelo GymClass | Sin ruta dedicada; defaultPath → /admin → bloqueado | ⚠️ Gap documentado |
| **MEMBER**     | Solo `/members/*` | MemberRoute → /member/* | ✅ |

---

## Detalle por área

### 1. Admin (ADMIN / SUPERADMIN)

| Vista / API | Backend | Frontend | Notas |
|-------------|---------|----------|--------|
| GET /users (socios) | requireStaff | AdminMembers usa **MOCK_MEMBERS** | ❌ No conectado: la vista Socios no llama al API real |
| GET /users?role_not=MEMBER (staff) | requireStaff | AdminStaffView → fetchStaffUsers | ✅ |
| DELETE /users/:id | requireAdminOrSuperAdmin | AdminStaffView → deleteUser | ✅ |
| renew, freeze, unfreeze, cancel-subscription | requireAdminOrSuperAdmin | **No existen en apiClient** | ❌ Falta implementar en cliente y en vista Socios |
| GET /users/:id/data-export, POST anonymize | requireAdminOrSuperAdmin | No en apiClient ni en UI | ❌ Falta |
| Cortes de caja, Force close | requireAdminOrSuperAdmin / requireAuth | AdminShifts | ✅ |
| POS (productos, ventas, egresos, turnos) | requireAuth + módulo pos | ReceptionPos (recepción o admin) | ✅ |
| Inventario | requireAdminOrSuperAdmin (delete, loss) | AdminInventory | ✅ |
| Finanzas, Auditoría | requireAdminOrSuperAdmin | AdminFinance, AdminAudit | ✅ |
| Clases (listar, crear reserva) | requireAuth / requireAdminOrSuperAdmin (crear clase) | AdminClasses | ✅ |
| Rutinas | requireCoachOrAdmin | AdminRoutines | ✅ |

### 2. Recepción (RECEPTIONIST / ADMIN / SUPERADMIN)

| Vista / API | Backend | Frontend | Notas |
|-------------|---------|----------|--------|
| Check-in, cortesía | requireAuth, courtesy = ADMIN only | ReceptionCheckIn | ✅ Regenerate QR solo si canRegenerateQr (ADMIN/SUPERADMIN) |
| POS, egresos, cierre ciego | requireAuth | ReceptionPos, ShiftForms | ✅ |
| Buscar/editar socios, enviar QR | requireStaff | ReceptionMembers | ✅ |
| Regenerar QR | requireAdminOrSuperAdmin | Solo visible si canRegenerateQr | ✅ |

### 3. Socio (MEMBER)

| Vista / API | Backend | Frontend | Notas |
|-------------|---------|----------|--------|
| /members/me, history, send-qr | Solo MEMBER | MemberHome, MemberHistory, etc. | ✅ |

### 4. COACH

- Backend: puede usar rutinas (list, create, update, delete, exercises) y PATCH booking attend.
- Frontend (tras corrección): puede entrar a /admin; en el menú solo ve **Clases** y **Rutinas**. defaultPath para COACH → `/admin/routines`. Si accede a `/admin`, AdminDashboard redirige a `/admin/routines`.

### 5. INSTRUCTOR

- Backend: **no** está en requireCoachOrAdmin; solo aparece como `instructor_id` en GymClass. Las llamadas a rutinas o markAttendance devolverán 403.
- Frontend (tras corrección): puede entrar a /admin con el mismo menú limitado que COACH (Clases, Rutinas) y defaultPath → `/admin/routines`. Si el producto quiere que INSTRUCTOR use rutinas/asistencia, hay que añadir INSTRUCTOR a requireCoachOrAdmin en el backend.

---

## Gaps e inconsistencias

1. **Admin Members (Socios)**  
   - Usa datos mock.  
   - No usa: GET /users, renew, freeze, unfreeze, cancel-subscription, data-export, anonymize.  
   - **Falta:** Conectar la vista a getUsers (o equivalente) y añadir en apiClient las funciones renewSubscription, freezeSubscription, unfreezeSubscription, cancelSubscription, exportUserData, anonymizeUserData, y enlazarlas a acciones en la tabla de socios.

2. **COACH**  
   - **Corregido:** Ahora puede acceder a /admin con menú limitado (Clases, Rutinas) y defaultPath → /admin/routines.

3. **INSTRUCTOR**  
   - Sin UI y sin permisos en backend para rutinas/asistencia.  
   - Decisión de producto: darle rol similar a COACH en backend y mismo menú limitado en front, o dejarlo sin panel.

4. **apiClient**  
   - Faltan: renewSubscription, freezeSubscription, unfreezeSubscription, cancelSubscription, exportUserData, anonymizeUserData (todas requieren requireAdminOrSuperAdmin).

---

## Checklist rápida por rol

- **SUPERADMIN:** /saas, métricas, gimnasios, tier, módulos. ✅  
- **ADMIN:** Dashboard, Socios (mock), Finanzas, Inventario, Cortes, Personal, Clases, Rutinas, Auditoría. ✅ (Socios pendiente de conectar API y acciones de suscripción).  
- **RECEPTIONIST:** Check-in, POS, Cierre ciego, Egresos tipados, Buscar/editar socios, Enviar QR. ✅ Regenerar QR oculto.  
- **COACH:** Solo Clases y Rutinas en /admin. ✅  
- **INSTRUCTOR:** Sin acceso útil. ⚠️  
- **MEMBER:** Portal socio (perfil, historial, recompensas, QR). ✅  
