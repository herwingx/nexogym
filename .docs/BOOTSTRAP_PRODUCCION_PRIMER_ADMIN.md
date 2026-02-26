# Primer arranque en producción y cómo tener tu usuario admin

Qué hacer cuando subes a producción con la base de datos vacía: quién puede iniciar sesión, cómo se crea el primer SuperAdmin y cómo crear un admin para tu propio gym.

---

## 1. Flujo recomendado: `bootstrap-superadmin` (producción con DB vacía)

Para producción con una base de datos vacía, usa el script **bootstrap-superadmin**. Es la opción recomendada porque:

- Solo crea el gym interno de plataforma + el usuario SuperAdmin (sin datos de prueba).
- No crea gyms de demostración (FitZone, IronHouse, etc.).
- Permite definir tu propio email y contraseña mediante variables de entorno.
- Marca el usuario con `must_change_password: true`, obligando a cambiar la contraseña en el primer login.

### Pasos obligatorios (una sola vez)

1. **Aplicar el esquema de la base de datos**
   ```bash
   cd backend
   npm run db:push
   ```
   (O `prisma migrate deploy` si usas migraciones.)

2. **Configurar variables de entorno de producción**
   En `backend/.env` (o en los secrets del servidor):
   - `DATABASE_URL` o `DIRECT_URL` → base de datos de producción
   - `SUPABASE_URL` → URL del **mismo** proyecto Supabase que usará el frontend en producción
   - `SUPABASE_SERVICE_ROLE_KEY` → Service Role Key (Supabase → Settings → API)

3. **Ejecutar el bootstrap del SuperAdmin**
   ```bash
   cd backend
   SUPERADMIN_EMAIL=ops@tudominio.com \
   SUPERADMIN_PASSWORD="TuContraseñaSegura123" \
   SUPERADMIN_NAME="Tu Nombre" \
   npm run bootstrap-superadmin
   ```

4. **Iniciar sesión como SuperAdmin**
   - Email y contraseña: los que pasaste en las variables (o los valores por defecto).
   - En el **primer login** aparecerá un modal obligatorio para cambiar la contraseña.
   - Tras cambiar, accedes al panel `/saas` (gestión de gyms, tiers, módulos, etc.).

---

## 2. Script `bootstrap-superadmin`: cómo funciona

### Descripción

El script `backend/scripts/bootstrap-superadmin.ts` crea el primer usuario de la plataforma (SuperAdmin) y el gym interno necesario para su rol. Es idempotente en el sentido de que, si ya existe un SuperAdmin en la base de datos, no crea duplicados y termina con éxito.

### Requisitos

- Base de datos PostgreSQL vacía o sin SuperAdmin previo.
- Variables en `backend/.env`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DIRECT_URL` o `DATABASE_URL`

### Variables de entorno del script

| Variable | Obligatoria | Default | Descripción |
|----------|-------------|---------|-------------|
| `SUPERADMIN_EMAIL` | No | `superadmin@nexogym.dev` | Email del SuperAdmin. En producción, usa tu propio email. |
| `SUPERADMIN_PASSWORD` | No | `SuperAdmin2025!` | Contraseña inicial. En producción, usa una contraseña segura. |
| `SUPERADMIN_NAME` | No | `Super Admin` | Nombre mostrado del SuperAdmin. |

### Qué hace el script (orden de operaciones)

1. Comprueba si ya existe un usuario con rol `SUPERADMIN` en la base de datos. Si existe, imprime un mensaje y termina (no sobrescribe nada).

2. Crea el gym interno de plataforma (`GymSaaS Platform (Internal)`):
   - Plan: `PREMIUM_BIO`
   - Módulos: todos activos (pos, qr_access, gamification, classes, biometrics)
   - Tema: colores por defecto (indigo)

3. Crea el usuario `User` en la base de datos con `role: SUPERADMIN` asociado a ese gym.

4. Crea el usuario en **Supabase Auth** con:
   - Email y contraseña indicados (o valores por defecto)
   - `email_confirm: true` (no requiere verificación de email)
   - `user_metadata: { must_change_password: true }` (obliga a cambiar contraseña en el primer login)

5. Vincula el `auth_user_id` de Supabase con el `User` de la base de datos.

### Casos especiales

- **El email ya existe en Supabase Auth:** El script actualiza la contraseña, vincula el usuario existente con el `User` de la base de datos y mantiene `must_change_password: true`.
- **Ejecución múltiple:** Si ya hay un SuperAdmin en la DB, el script no crea nada nuevo y sugiere usar `npm run link-superadmin` si necesitas re-vincular credenciales.

### Uso en producción (recomendado)

```bash
cd backend
SUPERADMIN_EMAIL=ops@tudominio.com \
SUPERADMIN_PASSWORD="TuContraseñaSegura123" \
SUPERADMIN_NAME="Tu Nombre" \
npm run bootstrap-superadmin
```

No dejes credenciales en el historial de comandos: usa variables de entorno o un gestor de secretos.

### Uso en desarrollo (valores por defecto)

```bash
cd backend
npm run bootstrap-superadmin
```

Usa `superadmin@nexogym.dev` / `SuperAdmin2025!`.

---

## 3. Alternativa: seed completo (desarrollo y datos de prueba)

El comando `npm run db:seed` crea:

- SuperAdmin + gym interno de plataforma.
- Varios gyms de demostración (FitZone, IronHouse, PowerFit, CrossBox, EliteBody, MegaFit) con socios, ventas, clases, etc.

Úsalo solo en **desarrollo** para tener datos de prueba. En producción, prefiere `bootstrap-superadmin`.

### Cuándo usar el seed

- Entorno local o staging con datos de ejemplo.
- Pruebas de UI, flujos de recepción, POS, etc.

### Cuándo no usar el seed

- Producción: genera muchos registros de prueba innecesarios.

---

## 4. ¿Quién es “admin” en este proyecto?

| Rol | Quién es | Para qué |
|-----|----------|----------|
| **SUPERADMIN** | Tú, administrador de la plataforma NexoGym | Entras a **/saas**: crear/editar/eliminar gyms, ver métricas globales, cambiar tier y módulos por gym. No “operas” un gym concreto. |
| **ADMIN** | Dueño o gerente de un gym concreto | Entra a **/admin** de **su** gym: socios, finanzas, inventario, personal, auditoría, etc. |

El bootstrap o el seed solo crean al **SuperAdmin**. Para tener un **admin de un gym** (tu negocio o un cliente), crea el gym desde `/saas` o usa el script `create-gym-admin`.

---

## 5. Cómo tener “tu” usuario admin de un gym

Después del bootstrap tienes SuperAdmin. Para dar de alta un gym y su admin:

### Forma recomendada: Crear gym + admin desde /saas

En el panel `/saas`, botón **Crear gimnasio**. Puedes indicar:

- Nombre del gimnasio, plan (tier), logo y colores.
- **Opcional:** email, contraseña y nombre del **administrador** del gym.

Si rellenas email y contraseña del admin, el backend crea el gym y el usuario en Supabase Auth + User en DB con rol ADMIN. Ese admin podrá iniciar sesión y entrar a `/admin` de su gym. En el primer login se le pedirá cambiar la contraseña (contraseñas temporales).

**Requisito:** `SUPABASE_SERVICE_ROLE_KEY` en el `.env` del backend.

### Alternativa: Script `create-gym-admin`

Si creaste el gym sin admin en el modal:

```bash
cd backend
GYM_ID=<uuid-del-gym> \
GYM_ADMIN_EMAIL=admin@tudominio.com \
GYM_ADMIN_PASSWORD="TuContraseñaSegura" \
GYM_ADMIN_NAME="Tu Nombre" \
npm run create-gym-admin
```

El admin también tendrá `must_change_password: true` en el primer login.

### Vincular SuperAdmin existente (Supabase): `link-superadmin`

Si tienes un SuperAdmin en la DB pero no está vinculado a Supabase Auth (por ejemplo, ejecutaste el seed sin `SUPABASE_SERVICE_ROLE_KEY`), usa:

```bash
cd backend
npm run link-superadmin
```

Este script crea/actualiza el usuario en Supabase Auth (`superadmin@nexogym.dev` / `SuperAdmin2025!`) y lo vincula al `User` de la DB. Requiere que el SuperAdmin ya exista en la base de datos.

---

## 6. Resumen rápido

| Pregunta | Respuesta |
|----------|-----------|
| **¿Cómo inicio sesión la primera vez en producción con DB vacía?** | Ejecuta `npm run bootstrap-superadmin` con tus variables. Entra con el email y contraseña indicados (o `superadmin@nexogym.dev` / `SuperAdmin2025!` por defecto). Cambia la contraseña en el primer login. |
| **¿Seed o bootstrap?** | **Producción (DB vacía):** `bootstrap-superadmin`. **Desarrollo con datos de prueba:** `db:seed`. |
| **¿Me creo yo mi usuario admin de un gym?** | Crea el gym desde `/saas` (con email y contraseña del admin) o usa `npm run create-gym-admin` con `GYM_ID`, `GYM_ADMIN_EMAIL`, `GYM_ADMIN_PASSWORD`. |
| **¿Olvidé la contraseña del SuperAdmin?** | Usa “¿Olvidaste tu contraseña?” en la pantalla de login (requiere SMTP configurado en Supabase) o ejecuta `link-superadmin` con la contraseña por defecto para resetear. |
| **¿Cambiar email del SuperAdmin?** | Supabase Dashboard → Authentication → Users → editar el usuario. |
| **¿Staff (recepción, instructores)?** | Admin da usuario y contraseña en persona; no se envía email al staff. Si resetea contraseña, la nueva va al correo del Admin. Ver **CANALES_COMUNICACION.md**. |

---

## 7. Checklist “Primera vez en producción”

1. [ ] DB de producción creada y accesible.
2. [ ] `backend/.env` con `DATABASE_URL`/`DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` de **producción**.
3. [ ] `npm run db:push` (o `migrate deploy`) ejecutado contra la DB de producción.
4. [ ] `npm run bootstrap-superadmin` ejecutado **una vez** con `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` de producción.
5. [ ] Frontend de producción configurado con `VITE_SUPABASE_URL` (y anon key) del **mismo** proyecto Supabase.
6. [ ] Probar login con el email y contraseña configurados → acceder a `/saas`.
7. [ ] Cambiar la contraseña en el primer login (modal obligatorio).
8. [ ] Crear tu gym desde /saas (nombre, tier, logo, colores, admin opcional). Si indicas email/contraseña del admin, recibe bienvenida por correo (requiere `APP_LOGIN_URL` en `.env`).
9. [ ] Si no creaste admin al dar de alta el gym: ejecutar `npm run create-gym-admin` con `GYM_ID`, `GYM_ADMIN_EMAIL`, `GYM_ADMIN_PASSWORD`.
