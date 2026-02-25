# Flujo de Desarrollo — GymSaaS

Guía de referencia para cualquier persona que trabaje en el proyecto:
entornos disponibles, cómo configurar variables, comandos de base de datos,
cómo manejar el seed de datos de prueba y cómo probar todos los endpoints en Swagger.

---

## Comandos de base de datos

| Comando | Descripción |
|---|---|
| `npm run db:push` | Sincroniza el schema con la DB (dev, sin generar migration file) |
| `npm run db:migrate` | Crea un archivo de migración SQL versionado + lo aplica |
| `npm run db:seed` | Puebla la DB local con datos de prueba realistas |
| `npm run db:reset` | **Destruye** y re-crea la DB local, luego re-seedea automáticamente |
| `npm run db:fresh` | Alias de `db:reset` |
| `npm run db:studio` | Abre Prisma Studio (GUI visual de la DB) en el browser |
| `npm run db:enforce-modules` | Aplica el trigger SQL que fuerza `modules_config` por plan |

---

## Mapa de entornos

El proyecto maneja **tres entornos** con reglas distintas.
Respetarlas evita corromper datos reales o exponer configuraciones sensibles.

| | `development` | `staging` | `production` |
|---|---|---|---|
| **Rama** | `feature/*`, `fix/*` (local) | `main` (auto-deploy en CI) | Tag `vX.Y.Z` o merge manual |
| **DB** | Supabase proyecto **dev** (tuyo) | Supabase proyecto **staging** | Supabase proyecto **prod** |
| **Variables** | `backend/.env` + `backend/prisma/.env` | GitHub Actions Secrets | Panel de hosting (Railway / Render) |
| **Schema** | `db:push` ✅ | `prisma migrate deploy` ✅ | `prisma migrate deploy` ✅ |
| **Seed** | `db:seed` ✅ | ❌ nunca | ❌ nunca |
| **Reset** | `db:reset` ✅ | ❌ nunca | ❌ nunca |

> **Un proyecto Supabase por entorno.** Dev, staging y prod deben ser proyectos
> completamente separados. Nunca apuntar dos entornos al mismo proyecto.

---

## Variables de entorno

Ningún `.env` se sube al repositorio (están en `.gitignore`).
Crea los tuyos localmente copiando los ejemplos:

```bash
cp backend/.env.example        backend/.env
cp backend/prisma/.env.example backend/prisma/.env
```

- **`backend/.env`** — Configuración del servidor Express (puerto, Supabase, CORS, rate limits, etc.).
  Ver [`backend/.env.example`](../backend/.env.example) para todas las variables disponibles.

- **`backend/prisma/.env`** — Solo contiene `DIRECT_URL`.
  Prisma necesita conexión directa (sin pgbouncer) para migraciones y seeds.
  Ver [`backend/prisma/.env.example`](../backend/prisma/.env.example).

En staging y producción estas variables se configuran como **Secrets** en GitHub Actions
o en el panel de la plataforma de hosting. Nunca hardcodeadas en el código.

---

## Setup desde cero (primera vez)

```bash
git clone https://github.com/herwingx/gym-saas
cd gym-saas/backend
npm install

# Crear y rellenar los archivos .env con tus credenciales de Supabase DEV
cp .env.example .env
cp prisma/.env.example prisma/.env
# → edita ambos archivos con tus URLs y keys

npm run db:push      # Aplica el schema a tu DB de dev
npm run db:seed      # Puebla con datos de prueba realistas
npm run dev          # Levanta el servidor en http://localhost:3000
```

---

## Ciclo de trabajo diario

```bash
# Crear rama para tu feature
git checkout -b feature/nombre-feature

# ... desarrollas y pruebas en Swagger (http://localhost:3000/api-docs) ...

npm test             # Validas que no rompiste nada antes del PR
git push
# → abrir Pull Request a main
```

---

## Cuándo usar cada comando de DB

| Situación | Comando |
|---|---|
| Primer setup del proyecto | `db:push` → `db:seed` |
| Iterando cambios en `schema.prisma` durante desarrollo | `db:push` |
| Listo para hacer PR con cambio de schema | `db:migrate --name descripcion-del-cambio` |
| La DB quedó sucia con datos inventados en Swagger | `db:reset` |
| Quiero inspeccionar los datos visualmente | `db:studio` |
| Deploy a staging o producción | `prisma migrate deploy` (lo corre el CI automáticamente) |

---

## Reglas de oro

1. **`db:reset` y `db:seed` solo en `development`** — nunca en staging ni producción.
2. **Las migraciones viajan con el código** — si modificas `schema.prisma`, genera el migration file con `db:migrate` antes de abrir el PR. El CI lo aplicará en staging/prod con `migrate deploy`.
3. **Un proyecto Supabase por entorno** — nunca compartas la misma DB entre dev y staging.
4. **Los secrets nunca van al repo** — GitHub Actions Secrets para CI, panel del hosting para prod.

---

## Autenticación — cómo funciona y quién hace qué

### Arquitectura de auth (importante entender esto primero)

Este proyecto **no tiene endpoints propios de login, registro ni contraseña olvidada**.
Todo eso lo gestiona **Supabase Auth** directamente. La división de responsabilidades es:

```
FRONTEND                          SUPABASE AUTH                    BACKEND (este repo)
─────────                         ─────────────                    ───────────────────
login()          ──────────────►  valida credenciales
                 ◄──────────────  devuelve JWT (access_token)
                                                                    
API request      ──────────────────────────────────────────────►   requireAuth middleware
                                  ◄── supabase.auth.getUser(token)  verifica JWT
                                      devuelve { user.id }  ───►   busca en DB por auth_user_id
                                                                    adjunta req.gymId + req.userRole
                                                                    ── next() ──►  controlador
```

**En resumen:**
- **Supabase** se encarga de: registro, login, logout, refresh token, contraseña olvidada, magia de link.
- **Este backend** solo verifica que el JWT sea válido y resuelve el contexto interno del usuario (`gymId`, `role`).

---

### Flujos de auth completos

#### Login
```
[Frontend]  supabase.auth.signInWithPassword({ email, password })
            → Supabase devuelve { access_token, refresh_token, user }
            → Frontend guarda los tokens (localStorage / cookie segura)
            → Cada request al backend lleva: Authorization: Bearer <access_token>
```

#### Registro de nuevo usuario (Admin/Staff con email)
```
[Frontend]  supabase.auth.signUp({ email, password })
            → Supabase envía email de confirmación (configurable en el panel)
            → Al confirmar, el usuario existe en Supabase Auth
            → El Admin de su gym debe crearlo también en el backend:
               POST /api/v1/users  { name, phone, role, ... }
            → Luego vincular el auth_user_id:
               PATCH /api/v1/users/:id  { auth_user_id: "<UUID_de_Supabase>" }
```

> **Por qué hay dos pasos:** Supabase guarda email+password, el backend guarda
> `gym_id`, `role`, `pin_hash` y toda la lógica de negocio. El campo `auth_user_id`
> es el puente entre ambos sistemas.

#### Contraseña olvidada
```
[Frontend]  supabase.auth.resetPasswordForEmail(email, {
              redirectTo: 'https://tuapp.com/update-password'
            })
            → Supabase envía el email de recuperación automáticamente
            → El backend no participa en este flujo
```

#### Refresh de token (sesión expirada)
```
[Frontend]  supabase.auth.refreshSession()  ← el SDK de Supabase lo hace automáticamente
            → Devuelve nuevo access_token
            → Transparente para el backend
```

#### Logout
```
[Frontend]  supabase.auth.signOut()
            → Invalida el token en Supabase
            → Frontend borra tokens locales
            → El backend no tiene endpoint de logout
```

---

### Cómo obtener un JWT para probar en Swagger (dev)

**Paso 1** — Crea un usuario en Supabase Auth (solo la primera vez):

Ve a `https://supabase.herwingx.dev` → **Authentication → Users → Add user → Create new user**
y crea: `admin@dev.local` / `devpassword123`

**Paso 2** — Obtén el token con curl:

```bash
curl -s -X POST \
  'https://supabase.herwingx.dev/auth/v1/token?grant_type=password' \
  -H 'apikey: TU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@dev.local","password":"devpassword123"}'
```

La respuesta tiene este formato:
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "abc123...",
  "user": {
    "id": "uuid-del-usuario-en-supabase",
    ...
  }
}
```

Copia el `access_token` y el `user.id`.

**Paso 3** — Vincula ese usuario con el Admin del seed:

```bash
npm run db:studio
```

En la tabla `User` → busca el Admin del gym que quieres probar → edita el campo
`auth_user_id` → pega el `user.id` del paso anterior → guarda.

**Paso 4** — Autoriza en Swagger:

Abre `http://localhost:3000/api-docs` → botón **Authorize** → pega el `access_token` → **Authorize**.

A partir de aquí todos los endpoints protegidos funcionan en el contexto de ese gym y rol.

---

### Probar con curl directamente (sin Swagger)

Si prefieres probar endpoints desde terminal, aquí el flujo completo de ejemplo:

```bash
# 1. Login — guarda el token en variable
TOKEN=$(curl -s -X POST \
  'https://supabase.herwingx.dev/auth/v1/token?grant_type=password' \
  -H 'apikey: TU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@dev.local","password":"devpassword123"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

echo "Token: $TOKEN"

# 2. Probar endpoint protegido
curl -s -X GET 'http://localhost:3000/api/v1/users' \
  -H "Authorization: Bearer $TOKEN" \
  | jq .

# 3. Ver tu contexto (gym + rol)
curl -s -X GET 'http://localhost:3000/api/v1/users/me/context' \
  -H "Authorization: Bearer $TOKEN" \
  | jq .

# 4. Hacer check-in de un miembro (no requiere JWT, solo userId)
curl -s -X POST 'http://localhost:3000/api/v1/checkin' \
  -H 'Content-Type: application/json' \
  -d '{"userId":"ID_DEL_MIEMBRO","accessMethod":"MANUAL"}' \
  | jq .

# 5. Endpoint biométrico (requiere Hardware Key en vez de JWT)
curl -s -X POST 'http://localhost:3000/api/v1/biometric/checkin' \
  -H 'Content-Type: application/json' \
  -H 'X-Hardware-Key: API_KEY_DEL_GYM_PREMIUM' \
  -d '{"userId":"ID_MIEMBRO_PREMIUM"}' \
  | jq .
```

> `jq` formatea el JSON en terminal. Si no lo tienes: `sudo dnf install jq`

---

### Roles y qué puede hacer cada uno

| Rol | Acceso |
|---|---|
| `SUPERADMIN` | Todo el módulo `/saas/*`, métricas globales, gestión de todos los gyms |
| `ADMIN` | Todo dentro de su gym: usuarios, POS, inventario, clases, analytics |
| `RECEPTIONIST` | Check-in, POS (abrir/cerrar turno, ventas), consulta de miembros |
| `INSTRUCTOR` | Sus propias clases, rutinas de sus miembros |
| `MEMBER` | Sus propias reservas (`/booking/me`), su contexto (`/users/me/context`) |

El rol se resuelve desde el campo `role` de la tabla `User` en tu DB, **no** desde Supabase.
Supabase solo autentica. El backend autoriza.

---

## Testing manual en Swagger

Swagger disponible en `http://localhost:3000/api-docs` una vez el servidor esté corriendo.

### ⚠️ Gaps conocidos (léelos antes de empezar)

**GAP 1 — JWT de Supabase (bloquea la mayoría de endpoints)**

El seed crea usuarios en la DB pero **sin** `auth_user_id` ni cuenta en Supabase Auth.
Sigue los 4 pasos de la sección [Autenticación](#autenticaci%C3%B3n--c%C3%B3mo-funciona-y-qui%C3%A9n-hace-qu%C3%A9)
para obtener un JWT y vincularlo al usuario del seed.

Los endpoints de hardware (`POST /checkin`, `POST /biometric/checkin`) no necesitan JWT,
usan `X-Hardware-Key`. Ver tabla más abajo.

**GAP 2 — `auth_user_id` no está vinculado hasta que lo hagas manualmente**

`GET /users/me/context` solo funciona una vez que hayas hecho el Paso 3 de la sección
de autenticación (vincular el UUID de Supabase con el usuario en Prisma Studio).

---

### Qué queda fuera del repo y por qué (revisión posterior)

Todo lo que no se puede “completar” solo con código en este repo aparece aquí, para que al revisar sepas qué es y por qué.

| Qué queda fuera | Dónde se hace | Por qué no está en el repo |
|-----------------|----------------|----------------------------|
| **Branch protection** (PR obligatorio, aprobaciones, checks) | GitHub → Settings → Branches | Son reglas de la plataforma; se documentan en `.docs/BRANCH_PROTECTION.md` pero se activan en la UI de GitHub. |
| **Secrets y variables de entorno** (DB, Supabase, CORS, etc.) | GitHub Actions Secrets; panel del hosting (Railway, Render, etc.) para prod | No deben estar en el repo por seguridad; cada entorno se configura aparte. |
| **Proyectos Supabase (dev / staging / prod)** | Dashboard Supabase: crear proyectos y copiar URLs/keys | Un proyecto por entorno; la creación y la configuración (Redirect URLs, Storage buckets) es en el dashboard. |
| **Vincular JWT (auth_user_id) en dev** | Manual: Supabase Auth → crear usuario, luego Prisma Studio → editar `User.auth_user_id` | El seed no crea usuarios en Supabase Auth; es un paso manual de desarrollo para poder usar Swagger y el frontend con el mismo usuario. Solo afecta a dev. |
| **Cron para sync de suscripciones vencidas** | Scheduler del hosting, GitHub Actions scheduled workflow, o script externo que llame `POST /users/sync-expired-subscriptions` | El endpoint existe; quién lo llama y cada cuánto se configura en la infra, no en el código de la API. Ver `.docs/SUBSCRIPTION_EXPIRY_AND_RENEWAL.md`. |

---

### Valores del seed para usar en Swagger

Después de correr `npm run db:seed`, la consola imprime todos los IDs necesarios.
Guárdalos o consúltalos en cualquier momento con `npm run db:studio`.

#### Hardware API Keys (para endpoints biométricos)
Las claves están en la tabla `Gym` columna `api_key_hardware`.
Se usan como header: `X-Hardware-Key: <valor>`

---

### Checklist de endpoints por módulo

#### 🔓 Sin JWT — solo `userId` del seed

| Método | Endpoint | Body / Params | Qué probar |
|---|---|---|---|
| `POST` | `/api/v1/checkin` | `{ "userId": "<ID_MIEMBRO_ACTIVO>", "accessMethod": "MANUAL" }` | Check-in exitoso, streak +1 |
| `POST` | `/api/v1/checkin` | `{ "userId": "<ID_MIEMBRO_VENCIDO>", "accessMethod": "MANUAL" }` | Debe retornar `403` suscripción expirada |
| `POST` | `/api/v1/biometric/checkin` | Header `X-Hardware-Key` + `{ "userId": "..." }` | Solo en gym `PREMIUM_BIO` |

#### 👤 Módulo Usuarios (requiere JWT ADMIN)

| Método | Endpoint | Qué probar |
|---|---|---|
| `GET` | `/api/v1/users` | Lista todos los miembros del gym del admin |
| `GET` | `/api/v1/users/search?q=Juan` | Búsqueda parcial por nombre/teléfono |
| `POST` | `/api/v1/users` | Crear nuevo miembro |
| `PATCH` | `/api/v1/users/:id` | Editar nombre, teléfono, PIN |
| `DELETE` | `/api/v1/users/:id` | Soft delete (no borra de DB) |
| `PATCH` | `/api/v1/users/:id/renew` | Renovar: +30 días (desde hoy si venció/congelado; desde expires_at si sigue activo) |
| `PATCH` | `/api/v1/users/:id/freeze` | Congelar (guarda días restantes) |
| `PATCH` | `/api/v1/users/:id/unfreeze` | Descongelar (reactiva con días guardados desde hoy) |
| `POST` | `/api/v1/users/sync-expired-subscriptions` | Marcar ACTIVE con expires_at pasada como EXPIRED (cron diario) |
| `PATCH` | `/api/v1/users/:id/cancel-subscription` | Cancelar |
| `GET` | `/api/v1/users/:id/data-export` | Exportar datos GDPR |
| `POST` | `/api/v1/users/:id/anonymize` | Anonimizar (irreversible) |

#### 🛒 Módulo POS (requiere JWT, turno abierto)

> El seed crea un turno ABIERTO en los gyms PRO y PREMIUM.
> En el gym BÁSICO el turno está CERRADO — debes abrir uno primero.

| Método | Endpoint | Qué probar |
|---|---|---|
| `GET` | `/api/v1/pos/products` | Catálogo del POS |
| `GET` | `/api/v1/pos/shifts/current` | Turno activo del usuario |
| `POST` | `/api/v1/pos/shifts/open` | `{ "opening_balance": 500 }` |
| `POST` | `/api/v1/pos/sales` | `{ "items": [{ "productId": "...", "quantity": 1 }] }` |
| `GET` | `/api/v1/pos/sales` | Historial ventas del turno |
| `POST` | `/api/v1/pos/expenses` | `{ "amount": 50, "description": "Limpieza" }` |
| `POST` | `/api/v1/pos/shifts/close` | `{ "actual_balance": 1500 }` — Corte de caja |
| `GET` | `/api/v1/pos/shifts` | Historial de turnos |

#### 📦 Módulo Inventario (requiere JWT ADMIN)

| Método | Endpoint | Qué probar |
|---|---|---|
| `GET` | `/api/v1/inventory/products` | Lista con stock actual |
| `POST` | `/api/v1/inventory/products` | Crear producto con barcode opcional |
| `PATCH` | `/api/v1/inventory/products/:id` | Editar precio/nombre |
| `DELETE` | `/api/v1/inventory/products/:id` | Soft delete |
| `POST` | `/api/v1/inventory/restock` | `{ "productId": "...", "quantity": 20 }` |
| `POST` | `/api/v1/inventory/loss` | `{ "productId": "...", "quantity": 1, "reason": "Dañado" }` |
| `GET` | `/api/v1/inventory/transactions` | Historial de movimientos |

#### 📅 Módulo Clases y Reservas (requiere JWT, solo `PRO_QR` y `PREMIUM_BIO`)

| Método | Endpoint | Qué probar |
|---|---|---|
| `GET` | `/api/v1/booking/classes` | Lista clases del gym |
| `POST` | `/api/v1/booking/classes` | Crear clase (ADMIN) |
| `PATCH` | `/api/v1/booking/classes/:id` | Editar clase |
| `DELETE` | `/api/v1/booking/classes/:id` | Eliminar clase |
| `POST` | `/api/v1/booking` | `{ "classId": "...", "bookingDate": "2026-02-25" }` |
| `GET` | `/api/v1/booking/me` | Mis reservas |
| `DELETE` | `/api/v1/booking/:id` | Cancelar reserva |
| `PATCH` | `/api/v1/booking/:id/attend` | Marcar asistencia (ADMIN) |

#### 🏋️ Módulo Rutinas (requiere JWT)

| Método | Endpoint | Qué probar |
|---|---|---|
| `GET` | `/api/v1/routines/me` | Mis rutinas (como miembro) |
| `GET` | `/api/v1/routines/member/:userId` | Rutinas de un miembro (ADMIN) |
| `POST` | `/api/v1/routines` | `{ "userId": "...", "name": "Rutina A", "description": "..." }` |
| `PATCH` | `/api/v1/routines/:id` | Editar rutina |
| `DELETE` | `/api/v1/routines/:id` | Eliminar rutina |
| `POST` | `/api/v1/routines/:id/exercises` | `{ "name": "Sentadilla", "sets": 4, "reps": 10, "weight": 80 }` |
| `DELETE` | `/api/v1/routines/:id/exercises/:exerciseId` | Quitar ejercicio |

#### 📊 Módulo Analytics (requiere JWT ADMIN)

| Método | Endpoint | Qué probar |
|---|---|---|
| `GET` | `/api/v1/analytics/occupancy` | Semáforo en tiempo real (últimos 90 min) |
| `GET` | `/api/v1/analytics/revenue/daily?date=2026-02-24` | Ingresos del día |
| `GET` | `/api/v1/analytics/financial-report?month=2026-02` | Reporte mensual |
| `GET` | `/api/v1/analytics/audit-logs` | Historial de auditoría |

#### 🏢 Módulo SaaS Admin (requiere JWT SUPERADMIN)

| Método | Endpoint | Qué probar |
|---|---|---|
| `GET` | `/api/v1/saas/gyms` | Lista todos los gyms de la plataforma |
| `POST` | `/api/v1/saas/gyms` | Crear nuevo gym |
| `GET` | `/api/v1/saas/gyms/:id` | Detalle de un gym |
| `PATCH` | `/api/v1/saas/gyms/:id` | Editar configuración |
| `PATCH` | `/api/v1/saas/gyms/:id/tier` | Cambiar plan (verifica que `modules_config` cambia) |
| `GET` | `/api/v1/saas/gyms/:id/modules` | Ver feature flags activos |
| `GET` | `/api/v1/saas/gyms/:id/export` | Exportar todos los datos del gym |
| `DELETE` | `/api/v1/saas/gyms/:id` | Eliminar gym (cascade) |
| `GET` | `/api/v1/saas/metrics` | Métricas globales de la plataforma |

#### 🔐 Módulo Biométrico (requiere `X-Hardware-Key`, solo `PREMIUM_BIO`)

| Método | Endpoint | Headers | Body |
|---|---|---|---|
| `POST` | `/api/v1/biometric/checkin` | `X-Hardware-Key: <api_key_hardware del gym PREMIUM>` | `{ "userId": "<ID_MIEMBRO_PREMIUM>" }` |

---

## Database Seeding

El archivo `backend/prisma/seed.ts` crea un dataset completo que simula producción,
con tres gimnasios (uno por tier) listos para probar todos los módulos de la API.

### ¿Qué crea el seed?

| Entidad | FitZone Básico (`BASIC`) | PowerFit Pro (`PRO_QR`) | EliteBody Premium (`PREMIUM_BIO`) |
|---|---|---|---|
| **Staff** | Admin + Recepcionista | Admin + Recep. + Instructor | Admin + Recep. + 2 Instructores |
| **Miembros** | 5 (mix de estados) | 8 (con streaks y horarios restringidos) | 10 (streaks altos, VIP) |
| **Estados suscripción** | ACTIVE / EXPIRED / CANCELED / FROZEN | ídem | ídem |
| **Productos** | 3 | 5 | 8 |
| **Clases** | — | 2 (Spinning, Box Fit) | 3 (Yoga, CrossFit, Pilates) |
| **Reservas** | — | 5 bookings | 7 bookings |
| **Turnos de Caja** | 1 cerrado con ventas | 1 abierto + venta + gasto | 1 abierto + 2 ventas + gasto |
| **Transacciones inventario** | SALE + RESTOCK | SALE + RESTOCK | SALE + RESTOCK + LOSS |
| **Visitas** | MANUAL | QR + MANUAL | QR + BIOMETRIC + MANUAL |
| **Rutinas** | — | 2 miembros | 3 miembros (5 ejercicios c/u) |

Adicionalmente se crea un **SUPERADMIN** en un gym interno de plataforma (`GymSaaS Platform (Internal)`).

### PINs de acceso (solo dev)

| Rol | PIN |
|---|---|
| SUPERADMIN | `0000` |
| ADMIN | `1234` |
| RECEPTIONIST | `4321` |
| INSTRUCTOR | `5678` / `8765` |

### Ejecutar el seed

```bash
cd backend
npm run db:seed
```

El comando imprime en consola todos los UUIDs generados (Gym IDs, User IDs, HW API Keys)
listos para copiar directamente en Swagger (`http://localhost:3000/api-docs`).

### Re-seedear desde cero

Si la DB ya tiene datos (por pruebas manuales en Swagger, por ejemplo):

```bash
npm run db:reset   # Destruye toda la DB, re-aplica el schema y corre db:seed automáticamente
```

> `db:reset` ejecuta internamente `prisma migrate reset --force`, que al terminar
> llama a `prisma db seed` de forma automática gracias a la clave `"prisma.seed"`
> definida en `package.json`.

### Notas importantes

- El seed **no es idempotente** — si ya existen datos, fallará por conflictos de `phone` único.
  Usa siempre `db:reset` antes de re-seedear.
- Los datos del seed son **exclusivamente para desarrollo local**.
  Nunca ejecutar contra staging ni producción.
- El gym interno de plataforma (`Platform Internal`) no tiene `api_key_hardware`
  para evitar colisiones con hardware real.

---

## Comandos de base de datos

| Comando | Descripción |
|---|---|
| `npm run db:push` | Sincroniza el schema con la DB (dev, sin generar migration file) |
| `npm run db:migrate` | Crea un archivo de migración SQL versionado + lo aplica |
| `npm run db:seed` | Puebla la DB local con datos de prueba realistas |
| `npm run db:reset` | **Destruye** y re-crea la DB local, luego re-seedea automáticamente |
| `npm run db:fresh` | Alias de `db:reset` |
| `npm run db:studio` | Abre Prisma Studio (GUI visual de la DB) en el browser |
| `npm run db:enforce-modules` | Aplica el trigger SQL que fuerza `modules_config` por plan |

---

## Mapa de entornos

El proyecto maneja **tres entornos** con reglas distintas.
Respetarlas evita corromper datos reales o exponer configuraciones sensibles.

| | `development` | `staging` | `production` |
|---|---|---|---|
| **Rama** | `feature/*`, `fix/*` (local) | `main` (auto-deploy en CI) | Tag `vX.Y.Z` o merge manual |
| **DB** | Supabase proyecto **dev** (tuyo) | Supabase proyecto **staging** | Supabase proyecto **prod** |
| **Variables** | `backend/.env` + `backend/prisma/.env` | GitHub Actions Secrets | Panel de hosting (Railway / Render) |
| **Schema** | `db:push` ✅ | `prisma migrate deploy` ✅ | `prisma migrate deploy` ✅ |
| **Seed** | `db:seed` ✅ | ❌ nunca | ❌ nunca |
| **Reset** | `db:reset` ✅ | ❌ nunca | ❌ nunca |

> **Un proyecto Supabase por entorno.** Dev, staging y prod deben ser proyectos
> completamente separados. Nunca apuntar dos entornos al mismo proyecto.

---

## Variables de entorno

Ningún `.env` se sube al repositorio (están en `.gitignore`).
Crea los tuyos localmente copiando los ejemplos:

```bash
cp backend/.env.example        backend/.env
cp backend/prisma/.env.example backend/prisma/.env
```

- **`backend/.env`** — Configuración del servidor Express (puerto, Supabase, CORS, rate limits, etc.).
  Ver [`backend/.env.example`](../backend/.env.example) para todas las variables disponibles.

- **`backend/prisma/.env`** — Solo contiene `DIRECT_URL`.
  Prisma necesita conexión directa (sin pgbouncer) para migraciones y seeds.
  Ver [`backend/prisma/.env.example`](../backend/prisma/.env.example).

En staging y producción estas variables se configuran como **Secrets** en GitHub Actions
o en el panel de la plataforma de hosting. Nunca hardcodeadas en el código.

---

## Setup desde cero (primera vez)

```bash
git clone https://github.com/herwingx/gym-saas
cd gym-saas/backend
npm install

# Crear y rellenar los archivos .env con tus credenciales de Supabase DEV
cp .env.example .env
cp prisma/.env.example prisma/.env
# → edita ambos archivos con tus URLs y keys

npm run db:push      # Aplica el schema a tu DB de dev
npm run db:seed      # Puebla con datos de prueba realistas
npm run dev          # Levanta el servidor en http://localhost:3000
```

---

## Ciclo de trabajo diario

```bash
# Crear rama para tu feature
git checkout -b feature/nombre-feature

# ... desarrollas y pruebas en Swagger (http://localhost:3000/api-docs) ...

npm test             # Validas que no rompiste nada antes del PR
git push
# → abrir Pull Request a main
```

---

## Cuándo usar cada comando de DB

| Situación | Comando |
|---|---|
| Primer setup del proyecto | `db:push` → `db:seed` |
| Iterando cambios en `schema.prisma` durante desarrollo | `db:push` |
| Listo para hacer PR con cambio de schema | `db:migrate --name descripcion-del-cambio` |
| La DB quedó sucia con datos inventados en Swagger | `db:reset` |
| Quiero inspeccionar los datos visualmente | `db:studio` |
| Deploy a staging o producción | `prisma migrate deploy` (lo corre el CI automáticamente) |

---

## Reglas de oro

1. **`db:reset` y `db:seed` solo en `development`** — nunca en staging ni producción.
2. **Las migraciones viajan con el código** — si modificas `schema.prisma`, genera el migration file con `db:migrate` antes de abrir el PR. El CI lo aplicará en staging/prod con `migrate deploy`.
3. **Un proyecto Supabase por entorno** — nunca compartas la misma DB entre dev y staging.
4. **Los secrets nunca van al repo** — GitHub Actions Secrets para CI, panel del hosting para prod.

---

## Database Seeding

El archivo `backend/prisma/seed.ts` crea un dataset completo que simula producción,
con tres gimnasios (uno por tier) listos para probar todos los módulos de la API.

### ¿Qué crea el seed?

| Entidad | FitZone Básico (`BASIC`) | PowerFit Pro (`PRO_QR`) | EliteBody Premium (`PREMIUM_BIO`) |
|---|---|---|---|
| **Staff** | Admin + Recepcionista | Admin + Recep. + Instructor | Admin + Recep. + 2 Instructores |
| **Miembros** | 5 (mix de estados) | 8 (con streaks y horarios restringidos) | 10 (streaks altos, VIP) |
| **Estados suscripción** | ACTIVE / EXPIRED / CANCELED / FROZEN | ídem | ídem |
| **Productos** | 3 | 5 | 8 |
| **Clases** | — | 2 (Spinning, Box Fit) | 3 (Yoga, CrossFit, Pilates) |
| **Reservas** | — | 5 bookings | 7 bookings |
| **Turnos de Caja** | 1 cerrado con ventas | 1 abierto + venta + gasto | 1 abierto + 2 ventas + gasto |
| **Transacciones inventario** | SALE + RESTOCK | SALE + RESTOCK | SALE + RESTOCK + LOSS |
| **Visitas** | MANUAL | QR + MANUAL | QR + BIOMETRIC + MANUAL |
| **Rutinas** | — | 2 miembros | 3 miembros (5 ejercicios c/u) |

Adicionalmente se crea un **SUPERADMIN** en un gym interno de plataforma (`GymSaaS Platform (Internal)`).

### PINs de acceso (solo dev)

| Rol | PIN |
|---|---|
| SUPERADMIN | `0000` |
| ADMIN | `1234` |
| RECEPTIONIST | `4321` |
| INSTRUCTOR | `5678` / `8765` |

### Ejecutar el seed

```bash
cd backend
npm run db:seed
```

El comando imprime en consola todos los UUIDs generados (Gym IDs, User IDs, HW API Keys)
listos para copiar directamente en Swagger (`http://localhost:3000/api-docs`).

### Re-seedear desde cero

Si la DB ya tiene datos (por pruebas manuales en Swagger, por ejemplo):

```bash
npm run db:reset   # Destruye toda la DB, re-aplica el schema y corre db:seed automáticamente
```

> `db:reset` ejecuta internamente `prisma migrate reset --force`, que al terminar
> llama a `prisma db seed` de forma automática gracias a la clave `"prisma.seed"`
> definida en `package.json`.

### Notas importantes

- El seed **no es idempotente** — si ya existen datos, fallará por conflictos de `phone` único.
  Usa siempre `db:reset` antes de re-seedear.
- Los datos del seed son **exclusivamente para desarrollo local**.
  Nunca ejecutar contra staging ni producción.
- El gym interno de plataforma (`Platform Internal`) no tiene `api_key_hardware`
  para evitar colisiones con hardware real.
