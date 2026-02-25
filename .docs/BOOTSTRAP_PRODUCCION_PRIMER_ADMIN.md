# Primer arranque en producción y cómo tener tu usuario admin

Qué hacer cuando subes a producción con la base de datos vacía: quién puede iniciar sesión, cómo se crea el primer admin y cómo crear un admin para tu propio gym.

---

## 1. DB vacía en producción: el primer arranque

Cuando la base de datos está vacía (primera vez en producción o después de vaciarla), **no existe ningún usuario** ni en tu DB ni en Supabase Auth vinculado a ella. Hay que “arrancar” el sistema una vez.

### Pasos obligatorios (una sola vez)

1. **Aplicar el esquema de la base de datos**  
   En el servidor o desde tu máquina contra la DB de producción:
   ```bash
   cd backend
   npm run db:push
   ```
   (O `prisma migrate deploy` si usas migraciones.)

2. **Configurar variables de entorno de producción**  
   En el entorno donde correrás el seed (o el script de bootstrap), con valores **de producción**:
   - `DATABASE_URL` o `DIRECT_URL` → base de datos de producción
   - `SUPABASE_URL` → URL del **mismo** proyecto Supabase que usará el frontend en producción
   - `SUPABASE_SERVICE_ROLE_KEY` → Service Role Key de **ese** proyecto (Supabase → Settings → API)

3. **Crear el primer usuario: el SuperAdmin**  
   Ejecutar el seed con esas variables:
   ```bash
   cd backend
   npm run db:seed
   ```
   El seed:
   - Crea el gym interno de plataforma y el usuario **SuperAdmin** en tu DB.
   - Crea en **Supabase Auth** el usuario `superadmin@nexogym.dev` con contraseña `SuperAdmin2025!` y vincula su ID en el campo `auth_user_id` del User en tu DB.

4. **Iniciar sesión como SuperAdmin**  
   En la app (frontend de producción):
   - Email: **superadmin@nexogym.dev**
   - Contraseña: **SuperAdmin2025!**  
   Entras al panel **/saas** (gestión de gyms, tiers, módulos, etc.). Ese eres tú como “admin de la plataforma”.

---

## 2. ¿Quién es “admin” en este proyecto?

Hay dos niveles:

| Rol | Quién es | Para qué |
|-----|----------|----------|
| **SUPERADMIN** | Tú, administrador de la plataforma NexoGym | Entras a **/saas**: crear/editar/eliminar gyms, ver métricas globales, cambiar tier y módulos por gym. No “operas” un gym concreto. |
| **ADMIN** | Dueño o gerente de un gym concreto | Entra a **/admin** de **su** gym: socios, finanzas, inventario, personal, auditoría, etc. |

El **primer arranque** (seed) solo crea al **SuperAdmin**. Con ese usuario ya puedes iniciar sesión y gestionar la plataforma. Para tener un **admin de un gym** (tu gym real) hace falta un paso más.

---

## 3. Cómo tener “tu” usuario admin de un gym (tu negocio)

Después del arranque tienes SuperAdmin y, si quieres, gyms creados desde **/saas**. Al **crear un gym** desde **/saas** (botón “Crear gimnasio”) puedes opcionalmente indicar el **email, contraseña y nombre** del primer administrador. Si los rellenas, el backend crea el gym y además el usuario en Supabase Auth y el User en la DB con rol ADMIN para ese gym. Así das de alta el gym y al admin en un solo paso.

### Forma recomendada: Crear gym + admin desde /saas

En el panel **/saas** (SuperAdmin), al pulsar **“Crear gimnasio”** puedes rellenar:

- Nombre del gimnasio y plan (tier).
- **Opcional:** email, contraseña y nombre del **administrador** del gym.

Si indicas email y contraseña del admin, el backend crea el gym y además el usuario en Supabase Auth y el User en la DB con rol ADMIN para ese gym. Ese admin puede iniciar sesión en la app y entrar a **/admin** de su gym.

**Requisito en el servidor:** el backend debe tener configurado `SUPABASE_SERVICE_ROLE_KEY` en el `.env` para poder crear usuarios en Supabase desde la API. Si no está configurado, el gym se crea pero no el admin (y puedes usar el script `create-gym-admin` después).

### Alternativa: Script `create-gym-admin` (si no creaste el admin al dar de alta)

Si creaste el gym **sin** rellenar el admin en el modal, o el servidor no tenía `SUPABASE_SERVICE_ROLE_KEY`, puedes crear el admin después con el script:

```bash
cd backend
GYM_ID=<uuid-del-gym> \
GYM_ADMIN_EMAIL=admin@tudominio.com \
GYM_ADMIN_PASSWORD="TuContraseñaSegura" \
GYM_ADMIN_NAME="Tu Nombre" \
npm run create-gym-admin
```

### Opción B: Usar el seed y “aprovechar” un admin de prueba

El seed crea varios gyms de **demostración** (FitZone, IronHouse, PowerFit, etc.) cada uno con un usuario ADMIN (admin@fitzone.dev, admin@ironhouse.dev, …). En producción puedes:

1. Ejecutar el seed completo (además del SuperAdmin obtienes esos gyms y admins).
2. Entrar como SuperAdmin, ir a /saas y **borrar** los gyms que no quieras (o dejarlos).
3. Para uno de los gyms que sí quieras usar: en Supabase Auth **cambiar el email** del admin de ese gym a tu email real y **cambiar la contraseña**. En la tabla `User` de tu DB ese registro ya tiene `gym_id` y `role: ADMIN`; solo tendrías que actualizar el `auth_user_id` si Supabase te dio un nuevo ID al cambiar el email (normalmente no, si solo cambias la contraseña).

Desventaja: el seed crea muchos datos de prueba (socios, ventas, etc.). Solo compensa si quieres datos de ejemplo o no te importa borrar después.

### Opción C: Manual (Supabase + DB)

1. En **Supabase** (producción): Authentication → Users → Add user → crear email + contraseña. Anotas el **User UID**.
2. En **tu DB**: crear un registro en la tabla `User` con `role: ADMIN`, `gym_id` = el ID del gym que quieras, `auth_user_id` = ese UID, y el resto de campos (nombre, teléfono, etc.) como quieras.
3. Inicias sesión en la app con ese email y contraseña. Entras como admin de ese gym.

---

## 4. Resumen rápido

| Pregunta | Respuesta |
|----------|-----------|
| **¿Cómo inicio sesión la primera vez en producción con DB vacía?** | Tras `db:push` y `db:seed` con env de producción, entras con **superadmin@nexogym.dev** / **SuperAdmin2025!**. Ese es tu usuario “admin de la plataforma” (/saas). |
| **¿Me creo yo mi usuario admin?** | El **SuperAdmin** ya está creado por el seed; ese eres tú para /saas. Para ser **admin de un gym concreto** (tu negocio): crea el gym desde /saas, luego ejecuta `npm run create-gym-admin` con `GYM_ID`, `GYM_ADMIN_EMAIL`, `GYM_ADMIN_PASSWORD` (ver sección 3). |
| **¿Puedo no ejecutar el seed completo?** | Sí. El seed crea SuperAdmin + muchos gyms y usuarios de prueba. Si quieres solo SuperAdmin, en el futuro se puede tener un “seed mínimo” o script de bootstrap que solo cree el gym de plataforma y el SuperAdmin (y opcionalmente un gym + un admin). Mientras tanto, el seed completo es la forma oficial de tener el primer usuario (SuperAdmin). |

---

## 5. Checklist “Primera vez en producción”

1. [ ] DB de producción creada y accesible.
2. [ ] `backend/.env` (o secrets del servidor) con `DATABASE_URL`/`DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` de **producción**.
3. [ ] `npm run db:push` (o `migrate deploy`) ejecutado contra la DB de producción.
4. [ ] `npm run db:seed` ejecutado **una vez** con esas variables.
5. [ ] Frontend de producción configurado con `VITE_SUPABASE_URL` (y anon key) del **mismo** proyecto Supabase.
6. [ ] Probar login: **superadmin@nexogym.dev** / **SuperAdmin2025!** → acceder a **/saas**.
7. [ ] (Opcional) Cambiar la contraseña del SuperAdmin en Supabase después del primer acceso.
8. [ ] Crear tu gym desde /saas (nombre, tier). Anotar el **GYM_ID** (UUID) del listado o de la respuesta al crear.
9. [ ] Ejecutar `npm run create-gym-admin` con GYM_ID, GYM_ADMIN_EMAIL, GYM_ADMIN_PASSWORD (y opcional GYM_ADMIN_NAME); comprobar login en /admin.
