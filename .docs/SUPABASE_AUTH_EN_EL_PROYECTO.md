# Cómo interactúa Supabase Auth con nuestro proyecto

Documento para entender qué hace Supabase Auth en NexoGym, cómo se conecta con nuestro backend y base de datos, y por qué lo usamos en lugar de implementar el login nosotros mismos.

---

## 1. ¿Qué es Supabase Auth y qué hace por nosotros?

**Supabase Auth** es un servicio externo que se encarga de:

- **Registrar usuarios** (email + contraseña, o proveedores como Google).
- **Comprobar credenciales** cuando alguien intenta iniciar sesión.
- **Emitir y gestionar tokens (JWT)** que representan “esta persona está autenticada”.
- **Refrescar tokens** cuando expiran, sin que el usuario tenga que volver a poner la contraseña.
- **Guardar la sesión** en el navegador (localStorage) para que al recargar la página siga logueado.

Nosotros **no guardamos contraseñas** ni implementamos flujos de “¿email/contraseña correctos?”. Eso lo hace Supabase. Nosotros solo usamos el resultado: un **token** que nuestro backend puede verificar.

---

## 2. Los dos “mundos” que tenemos

En el proyecto conviven **dos sitios** donde hay información de “usuarios”:

| Dónde | Qué guarda | Quién lo usa |
|-------|------------|--------------|
| **Supabase Auth** (en la nube) | Email, contraseña (hasheada), ID único del usuario en Auth | Login en el frontend; verificación del token en el backend |
| **Nuestra base de datos** (Postgres, tabla `User`) | `id`, `name`, `phone`, `role`, `gym_id`, `auth_user_id`, etc. | Toda la lógica de negocio: a qué gym pertenece, si es ADMIN, si tiene suscripción, etc. |

El **enlace** entre ambos es el campo **`auth_user_id`** en nuestra tabla `User`: ahí guardamos el **UUID del usuario en Supabase Auth**. Así sabemos: “este token de Supabase corresponde a este User de nuestra base de datos”.

```
Supabase Auth                    Nuestra base de datos
┌─────────────────────┐          ┌─────────────────────────────┐
│ User (Auth)         │          │ User (Prisma)               │
│ id: "abc-123-..."  │ ◄─────── │ auth_user_id: "abc-123-..."  │
│ email: admin@...   │  enlace  │ id: "uuid-interno"           │
│ (contraseña hasheada)│          │ role: ADMIN, gym_id: ...    │
└─────────────────────┘          └─────────────────────────────┘
```

Sin ese enlace (`auth_user_id`), el backend no podría saber qué rol ni qué gym tiene la persona que envió el token.

---

## 3. Flujo completo: desde “Iniciar sesión” hasta una petición a la API

### Paso 1: El usuario pone email y contraseña en el frontend

- El frontend usa el **cliente de Supabase** (`supabase.auth.signInWithPassword({ email, password })`).
- Esa petición va **directa a Supabase** (no a nuestro backend). La URL que ves en red es algo como `https://supabase.herwingx.dev/auth/v1/token?grant_type=password`.

### Paso 2: Supabase comprueba credenciales

- Supabase busca si existe un usuario con ese email en **Supabase Auth** y si la contraseña coincide.
- Si **no existe o la contraseña es incorrecta** → responde **400** y el frontend muestra “Credenciales inválidas”.
- Si **sí coincide** → Supabase devuelve una **sesión** (access_token, refresh_token, user id, etc.).

### Paso 3: El frontend guarda la sesión y pide “contexto” a nuestro backend

- El frontend guarda la sesión (el cliente de Supabase lo hace en localStorage por defecto).
- Luego llama a **nuestra API**: `GET /api/v1/users/me/context` con el header `Authorization: Bearer <access_token>`.

### Paso 4: El backend verifica el token con Supabase y busca nuestro User

- El **middleware de auth** (`requireAuth`) recibe el token.
- Llama a **Supabase** (`supabase.auth.getUser(token)`) para comprobar que el token es válido y obtener el **ID del usuario en Auth** (`data.user.id`).
- Con ese ID busca en **nuestra base de datos** un `User` cuyo `auth_user_id` (o `id`, por compatibilidad) coincida.
- Si **no encuentra ningún User** → responde **401** (ej. “User not found in database”).
- Si **sí lo encuentra** → rellena `req.user`, `req.gymId`, `req.userRole` y deja pasar la petición al controlador.

### Paso 5: El controlador usa nuestro User, no el de Supabase

- Por ejemplo `getMyContext` usa `req.user.id` (nuestro ID interno), `req.gymId`, `req.userRole` para leer de la tabla `User` y `Gym` y devolver nombre del gym, módulos, tema, etc.
- Todo eso viene de **nuestra base de datos**, no de Supabase. Supabase solo nos dio la certeza de “quién es” mediante el token.

Resumen del flujo:

```
[Frontend]  email + password
      │
      ▼
[Supabase Auth]  ¿Existe? ¿Contraseña ok? → Sí → access_token
      │
      ▼
[Frontend]  guarda sesión, llama GET /users/me/context  con  Authorization: Bearer <token>
      │
      ▼
[Backend]  requireAuth:  Supabase.getUser(token) → user id en Auth
      │                  Prisma: User donde auth_user_id = ese id  → req.user, req.gymId, req.userRole
      ▼
[Controlador]  usa req.user.id, req.gymId, etc. (todo de nuestra DB)
```

---

## 4. ¿Por qué no implementamos nosotros el login?

Implementar auth “a mano” implica mucho más de lo que parece:

### Lo que tendríamos que hacer nosotros

- Guardar contraseñas con un **hash seguro** (bcrypt/argon2) y nunca en texto plano.
- Gestionar **tokens (JWT)**:
  - Crear el token al hacer login.
  - Incluir en el token el user id (o algo que nos identifique) sin exponer datos sensibles.
  - Decidir expiración y refresh.
- **Refresh de tokens**: cuando el access_token caduca, renovarlo sin pedir de nuevo la contraseña (refresh_token, rotación, etc.).
- **Recuperación de contraseña**: emails, tokens de un solo uso, expiración.
- **Confirmación de email**: flujo y almacenamiento de “email verificado”.
- **Protección contra ataques**: rate limiting en login, bloqueo tras X intentos, etc.
- **Seguridad**: no equivocarnos con el almacenamiento de sesiones, cookies httpOnly, CSRF, etc.

### Lo que nos da Supabase Auth

| Nosotros tendríamos que… | Con Supabase Auth… |
|--------------------------|--------------------|
| Hashear y guardar contraseñas | Ellos guardan y hashean; nosotros nunca tocamos la contraseña. |
| Crear y firmar JWT | Ellos emiten el JWT y lo firman; nosotros solo lo verificamos. |
| Implementar refresh de sesión | El cliente `supabase-js` refresca el token automáticamente. |
| Construir “olvidé mi contraseña” | Flujo integrado (`resetPasswordForEmail`, emails configurables). |
| Confirmar emails | Opción `email_confirm` al crear usuario (p. ej. en el seed). |
| Mantener seguridad y parches | Supabase mantiene el servicio y las buenas prácticas. |

Es decir: **menos código nuestro, menos superficie de error y menos responsabilidad** en temas críticos (contraseñas, tokens, emails).

---

## 5. Ventajas concretas para nuestro proyecto

1. **Seguridad delegada**  
   Contraseñas, hashes, JWTs y refresh los maneja un servicio especializado. Nosotros nos centramos en reglas de negocio (roles, gym, suscripciones).

2. **Menos código y menos bugs**  
   No hay “login propio” en el backend: solo verificamos el token y miramos en nuestra DB. El frontend solo llama a `signInWithPassword` y luego usa el token en las peticiones.

3. **Sesión persistente y refresh**  
   El cliente de Supabase guarda la sesión y refresca el token. El usuario no tiene que volver a loguearse cada poco tiempo.

4. **Escalable a más métodos de login**  
   Si más adelante queremos “Login con Google” o con otro proveedor, Supabase Auth ya tiene flujos para eso; nosotros seguimos recibiendo el mismo tipo de token y el mismo `user.id` para enlazar con `auth_user_id`.

5. **Un solo lugar para “¿quién puede entrar?”**  
   Supabase decide “esta persona es quien dice ser”. Nosotros decidimos “esta persona, en nuestro sistema, tiene este rol y este gym”. Separación clara.

---

## 6. Variables de entorno y quién habla con Supabase

| Variable | Dónde | Uso |
|----------|--------|-----|
| `VITE_SUPABASE_URL` | Frontend | URL del proyecto Supabase (p. ej. `https://xxx.supabase.co` o `https://supabase.herwingx.dev`). |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Clave pública (anon) para el cliente en el navegador. Login y `getUser(token)` desde el cliente. |
| `SUPABASE_URL` | Backend | La misma URL del proyecto. |
| `SUPABASE_ANON_KEY` | Backend | Se usa para **verificar** el token con `supabase.auth.getUser(token)` (no para crear usuarios). |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Crear/actualizar usuarios en Auth desde el servidor: **scripts** (seed, `link-superadmin`, `create-gym-admin`) y **POST /saas/gyms** cuando se envían `admin_email` y `admin_password`. No exponer en el frontend. |

Frontend y backend deben apuntar al **mismo proyecto** (misma URL). Si el frontend usa un proyecto y el backend otro, el token de uno no será válido en el otro.

---

## 7. Resumen en una frase

**Supabase Auth se encarga de “¿quién es esta persona?” (login, contraseñas, tokens). Nuestro backend y nuestra base de datos se encargan de “qué puede hacer en NexoGym” (rol, gym, módulos, permisos).** El enlace entre ambos es `auth_user_id` en la tabla `User` y el flujo es: login en Supabase → token → backend verifica token con Supabase y busca nuestro User por `auth_user_id` → a partir de ahí todo usa nuestra DB.

---

## 8. Referencias en el código

- **Frontend**: `frontend/src/lib/supabaseClient.ts` (cliente Supabase), `frontend/src/pages/Login.tsx` (`signInWithPassword`), `frontend/src/components/auth/AuthRestore.tsx` (restaurar sesión y llamar a `/users/me/context`).
- **Backend**: `backend/src/lib/supabase.ts` (cliente para verificar token), `backend/src/middlewares/auth.middleware.ts` (`getUser(token)` + búsqueda por `auth_user_id`), `backend/src/controllers/saas.controller.ts` (createGym: crear admin en Auth + User en DB al dar de alta un gym), `backend/prisma/seed.ts`, `backend/scripts/link-superadmin-supabase.ts` y `backend/scripts/create-gym-admin.ts` (crear/actualizar usuario en Auth y vincular `auth_user_id`).
