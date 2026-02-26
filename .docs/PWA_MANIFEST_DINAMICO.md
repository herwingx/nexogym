# PWA: manifest dinámico (white-label)

La PWA usa un **manifest dinámico** para que, al instalar la app en el dispositivo, el usuario vea el **nombre del gym** (y su color de tema) en lugar de "NexoGym". Así la experiencia es white-label: la marca visible es la del cliente (el gimnasio).

---

## 1. Comportamiento

- **Sin sesión** (visitante o antes de iniciar sesión): el manifest devuelve nombre "NexoGym" y valores por defecto; la pestaña del navegador muestra "NexoGym" (desde el HTML).
- **Con sesión** (usuario ya logueado en un gym): el manifest devuelve el **nombre del gym**, **short_name** (truncado si es largo) y **theme_color** del gym. La descripción pasa a ser "Portal del socio — {nombre del gym}". Además, el **título de la pestaña del navegador** (y la meta `apple-mobile-web-app-title`) se actualizan en el frontend con el nombre del gym, de forma que todo sea coherente (white-label).

El navegador pide el manifest al cargar la página (`<link rel="manifest" href="/api/v1/manifest">`). Si el usuario ya tiene sesión, la cookie enviada permite al backend identificar el gym y personalizar la respuesta. El título de la pestaña se actualiza en React en cuanto hay contexto (user + gymName).

---

## 2. Implementación técnica

### Backend

- **GET /api/v1/manifest** (público, sin auth):
  - Lee la cookie `nexogym_gym_id` (httpOnly, seteada al cargar contexto).
  - Si existe y el gym está ACTIVE, devuelve JSON con `name`, `short_name`, `theme_color` y `description` del gym.
  - Si no, devuelve el manifest por defecto (NexoGym).
  - Cabecera `Cache-Control: public, max-age=300` para que el manifest se pueda actualizar tras login.

- **Cookie** `nexogym_gym_id`:
  - Se setea en la respuesta de **GET /users/me/context** (login y AuthRestore) **solo para usuarios que no son SUPERADMIN**. Para SUPERADMIN la cookie no se setea y se limpia si existía; así el manifest y la experiencia en `/saas` son siempre **Nexo Gym** (la marca), sin heredar nombre ni colores de ningún gym.
  - Opciones: `httpOnly`, `sameSite: lax`, `path: /`, `maxAge: 7 días`, `secure` en producción.

### Frontend

- **index.html:** No se incluye `<link rel="manifest">` en el HTML; así el navegador no pide el manifest antes de tener la cookie. El título inicial es "NexoGym".
- **Inyección del manifest:** En `App.tsx`, el hook `useManifestLink` añade `<link rel="manifest" href="...">` solo cuando `isBootstrapped` es true (tras login o restore). Si hay sesión, se usa un cache-buster (`?t=...`) para que el navegador pida el manifest con la cookie y el "Instalar" muestre el nombre del gym.
- **Título de pestaña (y PWA en iOS):** El hook `useDocumentTitle` actualiza `document.title` y la meta `apple-mobile-web-app-title`: para **SUPERADMIN** siempre "NexoGym"; para el resto, nombre del gym cuando hay sesión y `gymName`; si no, "NexoGym". El tema (color primario) para SUPERADMIN es siempre el azul Nexo (`#2563eb`), no el del gym.
- **Desarrollo:** En dev el frontend usa siempre `/api/v1` (proxy), no `VITE_API_BASE_URL`, para que la cookie y el manifest sean same-origin y el diálogo "Instalar" muestre el nombre del gym. Vite proxy redirige `/api/v1` al backend.

### Despliegue

- El mismo origen (o proxy) debe servir la SPA y `/api/v1/*` para que la cookie se envíe al pedir el manifest. Por ejemplo: nginx sirve la SPA en `/` y hace proxy de `/api/v1` al backend.

---

## 3. Producción: requisito para que el nombre del gym aparezca al instalar la PWA

Para que en producción el diálogo "Instalar app" muestre el nombre del gym (y no "NexoGym"), **frontend y API deben ser mismo origen**. Así la cookie `nexogym_gym_id` se guarda y se envía al pedir el manifest.

**Qué hacer:**

1. **Un solo dominio** para la app: por ejemplo `https://app.nexogym.com` (o el dominio que uses).
2. **Proxy de la API bajo ese dominio:** el servidor (nginx, Caddy, el hosting, etc.) debe:
   - Servir la SPA (build del frontend) en `/`.
   - Hacer proxy de `/api/v1` al backend (Node/Express).
3. **Build del frontend:** no definir `VITE_API_BASE_URL` en producción (o dejarlo vacío/relativo). Así el frontend usa rutas relativas `/api/v1` y todas las peticiones (contexto, manifest, etc.) van al mismo dominio; la cookie queda asociada a ese dominio y el navegador la envía al pedir el manifest.

**Si usas dos dominios** (p. ej. `app.nexogym.com` para frontend y `api.nexogym.com` para backend): la cookie la setea el backend (api.nexogym.com) y el manifest se pide desde la página (app.nexogym.com), por lo que el navegador no envía la cookie y el manifest sale con "NexoGym". En ese caso habría que cambiar la estrategia (servir el manifest desde el dominio del API u otras opciones). **Recomendación:** en producción usar siempre mismo origen + proxy.

**Resumen producción:**

| Configuración | Efecto |
|---------------|--------|
| Mismo dominio + proxy `/api/v1` al backend + sin `VITE_API_BASE_URL` (o relativo) | El nombre del gym se muestra al instalar la PWA. |
| Frontend y API en dominios distintos | El diálogo de instalación seguirá mostrando "NexoGym". |

---

## 4. Archivo estático `/manifest.json`

El archivo `frontend/public/manifest.json` con nombre "NexoGym" se mantiene como **fallback/referencia**. La app usa el manifest dinámico vía `/api/v1/manifest`; el estático no se enlaza en producción.

---

## 5. Resumen

| Aspecto | Detalle |
|--------|---------|
| **Objetivo** | Que la instalación PWA muestre el nombre del gym (white-label). |
| **Endpoint** | GET /api/v1/manifest |
| **Auth** | No requiere JWT; usa cookie `nexogym_gym_id` seteada en /users/me/context. |
| **Logout** | La cookie expira en 7 días; al cerrar sesión no se borra en backend (opcional: endpoint logout que limpie la cookie). |
