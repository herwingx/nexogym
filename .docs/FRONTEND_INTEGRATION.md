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
- **Admin** (`AdminLayout`): filtra ítems según `modules_config`. Clases y Rutinas solo se muestran si `classes === true`; Inventario y Cortes solo si `pos === true`. Si el usuario accede por URL directa a `/admin/classes` o `/admin/routines` sin el módulo habilitado, se redirige a `/admin`.
- **Member** (`MemberRoute`): si `qr_access === false` (plan BASIC), el portal de socios está **bloqueado**; el socio ve pantalla de bloqueo con botón Cerrar sesión. Si `qr_access === true`, acceso normal a Inicio, Premios, Historial, Perfil.

## 4) Manejo de errores estándar

- `401`: token ausente/expirado → logout o refresh session.
- `403` con mensaje `Feature disabled for current subscription: <module>` → mostrar banner de plan no habilitado.
- `404`: recurso inexistente en gym actual.
- `429`: rate limit → retry con backoff.
- `500`: error interno del servidor. En desarrollo, la API puede devolver en el body un campo **`detail`** con el mensaje técnico (ej. error de BD o Prisma). El cliente (`apiClient.fetchUserContext` y otros que lean el body de error) puede mostrar ese `detail` en el toast o en consola para facilitar la depuración (p. ej. "Error al cargar contexto: column X does not exist").

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
| **Bucket `profile-pictures` en Supabase** | Dashboard de Supabase → Storage → crear bucket y políticas | La subida de foto de perfil usa Supabase Storage; el bucket y sus límites (tamaño, MIME) se configuran en el proyecto de Supabase, no en el repo. Si el bucket no existe o no tiene límite de tamaño, las subidas pueden fallar. |
| **Bucket `gym-logos` en Supabase** | Dashboard de Supabase → Storage → crear bucket público | La subida de logos de gym (SuperAdmin → Crear gimnasio / Editar gym) usa el bucket `gym-logos`. Si no existe, la subida falla; se puede usar solo la URL manual. |
| **E2E mínimo** | Suite E2E (Playwright/Cypress, etc.) en el repo o en otro | Si aún no existe, hay que escribir y mantener los tests; depende de prioridad del equipo. |
| **Redirect URLs en Supabase** (recuperación de contraseña) | Supabase → Authentication → URL Configuration | Las URLs permitidas tras “olvidé contraseña” se configuran en el dashboard; no en código. |

## 7) Notas operativas

- `modules_config` no se define manualmente desde frontend.
- Se deriva del plan (`subscription_tier`) y está blindado también en DB.
- Para frontend SuperAdmin, usar además:
  - `POST /api/v1/saas/gyms` (crear gym; opcional: `admin_email`, `admin_password`, `admin_name` para crear el primer admin en el mismo paso).
  - `GET /api/v1/saas/gyms/:id/modules`
  - `PATCH /api/v1/saas/gyms/:id/tier`
- **Foto de perfil al alta (Registrar socio):** el backend acepta `profile_picture_url` opcional en `POST /users`. En recepción el formulario permite pegar una URL o subir archivo; la subida usa Supabase Storage bucket **`profile-pictures`** (crear el bucket en el dashboard y política de escritura si aplica). Si el bucket no existe, se puede usar solo el campo URL.

## 8) Navegación y breadcrumbs

- **Breadcrumbs:** Los layouts Admin, Reception y Member muestran breadcrumbs contextuales con botón "Volver" que navega al padre de la ruta (no usa `history.back()`).
- **Perfil:** La página Mi perfil incluye un enlace "Volver al dashboard/panel" visible para todos los roles.
- **Admin móvil:** En pantallas pequeñas, el sidebar se oculta y un botón hamburguesa abre un drawer con la misma navegación.
