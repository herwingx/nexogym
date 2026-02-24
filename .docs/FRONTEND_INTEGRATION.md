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
Respuesta esperada:

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
    }
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

## 4) Manejo de errores estándar

- `401`: token ausente/expirado → logout o refresh session.
- `403` con mensaje `Feature disabled for current subscription: <module>` → mostrar banner de plan no habilitado.
- `404`: recurso inexistente en gym actual.
- `429`: rate limit → retry con backoff.

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
- [ ] Router/menu condicionado por `modules_config`.
- [ ] Pantalla recepción usa `GET /users/search?q=`.
- [ ] Manejo visual de 401/403/429 homogéneo.
- [ ] E2E mínimo: login → context → menú dinámico → flujo check-in.

## 7) Notas operativas

- `modules_config` no se define manualmente desde frontend.
- Se deriva del plan (`subscription_tier`) y está blindado también en DB.
- Para frontend SuperAdmin, usar además:
  - `GET /api/v1/saas/gyms/:id/modules`
  - `PATCH /api/v1/saas/gyms/:id/tier`
