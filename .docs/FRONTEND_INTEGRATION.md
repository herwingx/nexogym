# Frontend Integration Playbook

Objetivo: integrar frontend con backend sin fricción, con contratos claros y flujo de inicialización único.

## 1) Bootstrap recomendado de la app

1. Login con Supabase.
2. Guardar JWT (access token) y enviarlo en cada request:
   - `Authorization: Bearer <token>`
3. Llamar una sola vez al iniciar sesión:
   - `GET /api/v1/users/me/context`
4. Con esa respuesta construir:
   - Perfil del usuario actual (`user`)
   - Contexto de gym (`gym`)
   - Feature flags (`gym.modules_config`) para ocultar/mostrar menús y rutas.

## 2) Endpoint de contexto (clave)

### `GET /api/v1/users/me/context`
Respuesta esperada (incluye white-label: `theme_colors`, `logo_url`):

```json
{
  "user": {
    "id": "uuid",
    "name": "Admin Gym",
    "role": "ADMIN",
    "profile_picture_url": null
  },
  "gym": {
    "id": "uuid",
    "name": "Gym Pro",
    "subscription_tier": "PRO_QR",
    "modules_config": {
      "pos": true,
      "qr_access": true,
      "gamification": true,
      "classes": true,
      "biometrics": false
    },
    "theme_colors": { "primary": "#2563eb" },
    "logo_url": null
  }
}
```

## 3) Mapeo menú ↔ módulo

- POS / Caja / Inventario → `modules_config.pos`
- Check-in QR → `modules_config.qr_access`
- Gamificación / Rachas / Premios → `modules_config.gamification`
- Clases y Reservas → `modules_config.classes`
- Biometría / Hardware → `modules_config.biometrics`

Regla UX: si `false`, ocultar menú/acción y no renderizar CTA.

**Implementación actual:**
- **Admin** (`AdminLayout`): filtra ítems según `modules_config`. Clases y Rutinas solo se muestran si `classes === true`; Inventario y Cortes solo si `pos === true`; **Gamificación** (Premios por racha) solo si `gamification === true` (`/admin/rewards`). Si el usuario accede por URL directa a `/admin/classes`, `/admin/routines` o `/admin/rewards` sin el módulo habilitado, la página muestra mensaje de plan no disponible o se redirige según el caso.
- **Member** (`MemberRoute`): si `qr_access === false` (plan BASIC), el portal de socios está **bloqueado**; el socio ve pantalla de bloqueo con botón Cerrar sesión. Si `qr_access === true`, acceso normal a Inicio, Premios, Historial, Perfil.

## 4) Manejo de errores estándar

- `401`: token ausente/expirado → logout o refresh session.
- **`403` "Feature disabled for current subscription":** el apiClient usa `getErrorFromResponse` y lanza `PlanRestrictionError`. Las páginas que cargan datos condicionados por plan muestran la tarjeta **`PlanRestrictionCard`** ("No tienes acceso a este recurso. No está incluido en el plan actual de tu gimnasio.") con botón Volver, igual que la pantalla que ve el socio en plan Basic. Helpers: `isPlanRestrictionError(e)` en `lib/apiErrors.ts`.
- **`404`:** el apiClient lanza `ResourceNotFoundError` con el mensaje del backend. El componente **`ResourceNotFound`** sirve para mostrar una pantalla "Recurso no encontrado" con botón Volver cuando la página quiera mostrar 404 en pantalla; en otros casos se usa toast con el mensaje.
- `429`: rate limit → retry con backoff.
- `500`: error interno del servidor. En desarrollo, la API puede devolver en el body un campo **`detail`** con el mensaje técnico (ej. error de BD o Prisma). El cliente puede mostrar ese `detail` en toast o consola.

## 5) Flujo de baja y privacidad (pantallas)

1. Exportar datos del socio:
   - `GET /api/v1/users/:id/data-export`
2. Cancelar suscripción:
   - `PATCH /api/v1/users/:id/cancel-subscription`
3. Anonimizar datos (irreversible):
   - `POST /api/v1/users/:id/anonymize`

## 6) Checklist de integración frontend

- [ ] Cliente HTTP único con interceptor de `Authorization`.
- [ ] Guard global que carga `GET /users/me/context` al iniciar sesión.
- [x] Router/menú condicionado por `modules_config` — AdminLayout oculta Clases/Rutinas si `classes === false`, Inventario/Cortes si `pos === false`. Páginas AdminClasses y AdminRoutines redirigen a `/admin` si el módulo no está habilitado.
- [ ] Pantalla recepción usa `GET /users/search?q=`.
- [ ] Manejo visual de 401/403/429 homogéneo.
- [ ] E2E mínimo: login → context → menú dinámico → flujo check-in.

### Qué falta y por qué (revisión posterior)

| Qué falta | Dónde hacerlo | Por qué no está “hecho” aquí |
|-----------|----------------|------------------------------|
| **Verificar ítems del checklist** | Código frontend (revisión manual o E2E) | Cada ítem es una decisión de implementación; este doc solo lista requisitos. Revisar que cada uno esté cubierto antes de dar por cerrada la integración. |
| **Buckets de Supabase Storage** | Ver **SUPABASE_STORAGE_BUCKETS.md** | Los buckets `gym-logos` y `profile-pictures` deben crearse y configurarse con políticas en el Dashboard. Guía paso a paso en ese documento. |
| **E2E mínimo** | Suite E2E (Playwright/Cypress, etc.) en el repo o en otro | Si aún no existe, hay que escribir y mantener los tests; depende de prioridad del equipo. |
| **Redirect URLs en Supabase** (recuperación de contraseña) | Supabase → Authentication → URL Configuration | Las URLs permitidas tras “olvidé contraseña” se configuran en el dashboard; no en código. |

## 7) Notas operativas

- `modules_config` no se define manualmente desde frontend.
- Se deriva del plan (`subscription_tier`) y está blindado también en DB.
- Para frontend SuperAdmin, usar además:
  - `POST /api/v1/saas/gyms` (crear gym; opcional: `admin_email`, `admin_password`, `admin_name` para crear el primer admin en el mismo paso).
  - `GET /api/v1/saas/gyms/:id/modules`
  - `PATCH /api/v1/saas/gyms/:id/tier`
- **Foto de perfil al alta (Registrar socio):** el backend acepta `profile_picture_url` opcional en `POST /users`. En recepción el formulario permite pegar una URL o subir archivo; la subida usa Supabase Storage bucket **`profile-pictures`** (ver **SUPABASE_STORAGE_BUCKETS.md** para configuración). Si el bucket no existe, se puede usar solo el campo URL.

## 8) Navegación y breadcrumbs

- **Breadcrumbs:** Los layouts Admin, Reception y Member muestran breadcrumbs contextuales con botón "Volver" que navega al padre de la ruta (no usa `history.back()`).
- **Perfil:** La página Mi perfil incluye un enlace "Volver al dashboard/panel" visible para todos los roles.
- **Admin móvil:** En pantallas pequeñas, el sidebar se oculta y un botón hamburguesa abre un drawer con la misma navegación.
