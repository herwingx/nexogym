# Headers de seguridad para el frontend

El frontend aplica en **dev** y **preview** (Vite) los headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. En **producción** quien sirve `index.html` y los estáticos debe enviar estos mismos y, si es posible, **Content-Security-Policy (CSP)**.

---

## Qué falta aquí y por qué

| Qué falta | Por qué no está en este repo |
|-----------|------------------------------|
| **Configuración real de headers en producción** | Los headers los envía el **servidor que sirve el frontend** (Vercel, Netlify, nginx, etc.). No se pueden “empaquetar” en el build; dependen del hosting que uses. Este doc solo da los valores y ejemplos para que los copies en tu servidor. |
| **CSP en Vite (dev/preview)** | Vite inyecta scripts inline en desarrollo; una CSP estricta rompería el hot reload. Por eso CSP se deja solo para producción, donde el servidor puede enviar una política adecuada. |

Cuando vayas a desplegar: elige tu plataforma (Vercel, nginx, etc.), abre este doc y aplica la sección correspondiente en la configuración del servidor.

---

## Headers recomendados en producción

Añadir en el servidor (nginx, Vercel, Netlify, etc.) que sirve el SPA:

| Header | Valor |
|--------|--------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` (o `SAMEORIGIN` si usas iframes propios) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=()` (ajustar si usas cámara para foto de perfil) |

## CSP (Content-Security-Policy)

Ejemplo mínimo; ajustar `connect-src` con tu API y el proyecto Supabase:

```txt
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://tu-api.ejemplo.com; img-src 'self' data: https: blob:; frame-ancestors 'none';
```

- **style-src 'unsafe-inline':** suele ser necesario con Tailwind/CSS-in-JS; si se puede evitar, mejor.
- **img-src:** `data:` y `https:` si usas fotos de perfil desde Supabase Storage; `blob:` si hay preview de archivos.
- **connect-src:** incluir el origen de la API y `https://*.supabase.co` (o el subdominio concreto).

### Vercel

Crear `frontend/vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

CSP se puede añadir en el mismo bloque (una entrada con `key: "Content-Security-Policy"` y el valor del ejemplo anterior).

### nginx

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; ..." always;
```

---

Ver también: [.docs/FRONTEND_SECURITY_AUDIT.md](FRONTEND_SECURITY_AUDIT.md).
