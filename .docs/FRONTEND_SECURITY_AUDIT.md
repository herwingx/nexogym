# Auditoría de Seguridad — Frontend (NexoGym SaaS)

Documento de auditoría del frontend para identificar vulnerabilidades y alinear el proyecto con buenas prácticas de seguridad en aplicaciones SaaS. **La autorización real debe estar siempre en el backend;** el frontend solo controla UX y no debe considerarse una capa de seguridad.

---

## 1. Resumen ejecutivo

| Área              | Estado   | Notas breves |
|-------------------|----------|--------------|
| Autenticación     | Aceptable| Supabase + Bearer; token no expuesto en código |
| Almacenamiento    | Aceptable| Sesión en localStorage (Supabase); store en memoria |
| API / Transporte  | Aceptable| HTTPS recomendado en producción; sin secrets en cliente |
| Variables de entorno | Correcto | Solo VITE_* públicas; .env en .gitignore |
| Protección de rutas | Correcto | ProtectedRoute + rutas por rol; solo UX |
| XSS / Inyección   | Correcto | Sin dangerouslySetInnerHTML ni eval |
| Headers / CSP     | Parcial  | Headers (X-Frame-Options, etc.) en Vite dev/preview; CSP en servidor (ver .docs/SECURITY_HEADERS.md) |
| Dependencias      | Correcto | npm audit: 0 vulnerabilidades; revisar periódicamente |
| Redirecciones     | Correcto | redirectTo validado (ruta interna); util getSafeRedirectTo para uso futuro |

**Conclusión:** No se detectaron fallos críticos. Se recomienda aplicar las mejoras de hardening (CSP, cookies seguras si se cambia estrategia, y revisión periódica de dependencias).

---

## 2. Autenticación y sesión

### 2.1 Flujo actual

- **Login:** Supabase `signInWithPassword` → se obtiene sesión; el token se guarda en el cliente de Supabase (por defecto en **localStorage**).
- **Restauración:** Al recargar, `AuthRestore` llama a `supabase.auth.getSession()` y luego a `/users/me/context` con el token para rellenar el store (Zustand). No se persiste el token en otro sitio.
- **Logout:** `supabase.auth.signOut()` + limpieza del store (`clearAuth()`).

### 2.2 Dónde está el token

- **Supabase:** clave tipo `sb-<project-ref>-auth-token` en **localStorage** (comportamiento por defecto de `@supabase/supabase-js`).
- **Zustand:** el token se guarda en memoria en `useAuthStore`; no hay `persist` de Zustand, por lo que no se duplica en localStorage/sessionStorage por esa vía.

### 2.3 Buenas prácticas aplicadas

- Token solo se envía en cabecera `Authorization: Bearer`; no en query ni en cuerpos de respuesta expuestos.
- No hay lógica de “recordar usuario” con contraseña en claro ni tokens indefinidos.
- Recuperación de contraseña vía Supabase (email + enlace) y actualización de contraseña con `updateUser`.

### 2.4 Recomendaciones

- **Producción:** Servir la app y la API solo por **HTTPS** para evitar robo de token en tránsito.
- **Opcional (más hardening):** Valorar uso de **cookie httpOnly** para el token si el backend puede establecerla y el frontend solo envía credenciales por cookie (menos expuesto a XSS que localStorage). Supabase por defecto usa localStorage; cambiar esto implica configuración custom o proxy.
- Mantener **tiempo de vida de sesión** y refresh configurados en Supabase (JWT expiry, refresh token).

---

## 3. Almacenamiento y datos sensibles

### 3.1 Qué se almacena

- **localStorage (Supabase):** sesión (access_token, refresh_token). Es el único uso de almacenamiento persistente para auth.
- **Memoria (Zustand):** `user`, `token`, `modulesConfig`, `tenantTheme`. Se pierde al recargar; se rehidrata con AuthRestore.

### 3.2 Buenas prácticas aplicadas

- No se guardan contraseñas ni datos de tarjetas en el frontend.
- No hay `sessionStorage` ni cookies propias con datos sensibles en el código actual.
- `.env` y `.env.local` están en `.gitignore`; solo se documentan en `.env.example` con placeholders.

### 3.3 Recomendaciones

- No añadir nunca **secrets** (service role key, API keys privadas) en variables `VITE_*`; se empaquetan en el bundle y son visibles en el cliente.
- Si en el futuro se guardan datos sensibles en localStorage (por ejemplo preferencias con PII), valorar cifrado o evitar guardar PII.

---

## 4. Llamadas a la API y transporte

### 4.1 Patrón actual

- Una única función: **`fetchWithAuth`** en `apiClient.ts`.
- Obtiene el token con `supabase.auth.getSession()` y lo envía en `Authorization: Bearer <token>`.
- `Content-Type: application/json` en peticiones.
- Base URL: `VITE_API_BASE_URL` o fallback `/api/v1`.

### 4.2 Buenas prácticas aplicadas

- Token no se pone en la URL ni en query params.
- No se exponen cabeceras internas sensibles más allá de lo necesario.
- CORS es responsabilidad del backend; el frontend no puede “bypassear” CORS desde el navegador.

### 4.3 Recomendaciones

- En producción, **VITE_API_BASE_URL** debe apuntar a `https://...`. No usar HTTP en producción.
- **Implementado:** timeout en `fetchWithAuth` (p. ej. 30 s por defecto con `AbortController`); no se hace retry automático en 4xx.

---

## 5. Variables de entorno (VITE_*)

### 5.1 Uso actual

- `VITE_SUPABASE_URL` — URL pública del proyecto Supabase.
- `VITE_SUPABASE_ANON_KEY` — clave anónima (pública por diseño; RLS protege datos).
- `VITE_API_BASE_URL` — URL base del backend (ej. `https://api.dominio.com/api/v1`).

Todas son **públicas por naturaleza**; se empaquetan en el bundle.

### 5.2 Buenas prácticas aplicadas

- No hay `VITE_*` con service role key ni secrets.
- `.env.example` solo documenta variables sin valores reales.
- `.gitignore` incluye `**/.env` y `**/.env.*` (excepto `.env.example`).

### 5.3 Recomendaciones

- No introducir nunca variables tipo `VITE_SECRET_*` o `VITE_SERVICE_ROLE_KEY`.
- En CI/CD, inyectar `VITE_*` en el build; no subir archivos `.env` con valores reales al repo.

---

## 6. Protección de rutas (control de acceso en cliente)

### 6.1 Implementación

- **ProtectedRoute:** exige `isBootstrapped` y `token` + `user`; si no, redirige a `/login`. No recibe `redirectTo` desde la URL.
- **AdminRoute / ReceptionRoute / MemberRoute:** comprueban `user.role` y muestran mensaje o contenido según corresponda.
- **SuperAdminDashboard:** comprueba `user?.role === 'SUPERADMIN'`.

### 6.2 Buenas prácticas aplicadas

- Rutas protegidas envueltas en un único punto (`ProtectedRoute`).
- No hay open redirect: `redirectTo` en `ProtectedRoute` es prop por defecto `/login`, no viene de `searchParams` ni de input del usuario.
- El rol se usa solo para mostrar/ocultar UI; la autorización real debe estar en el backend.

### 6.3 Recomendaciones

- **Nunca** confiar solo en el frontend para autorización: el backend debe validar JWT y rol en cada petición.
- **Implementado:** en `ProtectedRoute` el `redirectTo` se valida (solo path que empieza por `/` y no por `//`); existe `getSafeRedirectTo()` en `src/utils/safeRedirect.ts` para usar si en el futuro se lee redirect desde query params.

---

## 7. XSS e inyección

### 7.1 Estado actual

- No se usa `dangerouslySetInnerHTML`, `innerHTML`, `eval()` ni `document.write` en el código auditado.
- Contenido dinámico (nombres, emails, etc.) se muestra vía React (escape por defecto).

### 7.2 Recomendaciones

- Evitar en el futuro `dangerouslySetInnerHTML` con datos de usuario o de API sin sanitizar. Si es imprescindible, usar una librería de sanitización (DOMPurify) y CSP estricta.
- No construir URLs ni scripts con concatenación de input de usuario sin validar/sanitizar.

---

## 8. Headers de seguridad y CSP

### 8.1 Estado actual

- **Implementado (Vite):** en `vite.config.ts` un plugin aplica en **dev** y **preview**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (cámara solo self; micrófono/geolocalización desactivados).
- **Producción:** el servidor que sirve `index.html` debe enviar estos mismos headers y, si es posible, **CSP**. Ver guía en [.docs/SECURITY_HEADERS.md](SECURITY_HEADERS.md) (ejemplos para Vercel y nginx).

### 8.2 Recomendaciones (producción)

- **Content-Security-Policy:** restringir scripts a `'self'`, evitar `unsafe-inline`/`unsafe-eval` si es posible; permitir solo dominios de confianza para Supabase y la API (ver ejemplo en SECURITY_HEADERS.md).
- Mantener **X-Frame-Options**, **X-Content-Type-Options**, **Referrer-Policy** y **Permissions-Policy** en el servidor de producción.

Ejemplo mínimo de CSP (ajustar según Supabase y tu API):

```txt
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://api.tudominio.com; frame-ancestors 'none';
```

---

## 9. Dependencias

### 9.1 Sensibles desde el punto de vista de seguridad

- **@supabase/supabase-js:** auth y sesión; mantener actualizado y revisar changelog de seguridad.

### 9.2 Recomendaciones

- Ejecutar **`npm audit`** en `frontend/` de forma periódica y corregir vulnerabilidades altas/críticas.
- Revisar **dependencias transitivas** (por ejemplo las que usan `cookie` o `set-cookie-parser`) con `npm audit` o herramientas como Snyk.
- Fijar versiones en `package.json` o usar lockfile fiable; en CI, instalar con `npm ci`.

---

## 10. Otros puntos

### 10.1 Recuperación de contraseña

- Redirect de Supabase a `window.location.origin + '/login'`; el enlace de “restablecer” lleva al mismo origen. Asegurar que la URL de redirect esté permitida en el dashboard de Supabase (Redirect URLs).

### 10.2 Logs

- Solo hay un `console.warn` en `supabaseClient.ts` cuando faltan envs; no se vierten tokens ni datos de usuario. En producción se puede suprimir o enviar a un sistema de logging sin datos sensibles.

### 10.3 Open redirect

- No se usa `redirectTo` desde la URL; no hay open redirect en el flujo actual.

---

## 11. Lo que falta y por qué (revisión posterior)

Todo lo que no está hecho en código tiene una razón concreta. Esta sección sirve para que, al revisar, sepas **qué** falta y **por qué** no está en el repo.

| Qué falta | Dónde hacerlo | Por qué no está hecho aquí |
|-----------|----------------|----------------------------|
| **Headers de seguridad en producción** (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | Servidor o proxy que sirve el frontend (Vercel, Netlify, nginx, etc.) | Los headers los envía quien sirve `index.html`; no Vite ni el bundle. Depende del hosting que elijas. |
| **CSP (Content-Security-Policy) en producción** | Mismo servidor que sirve el frontend | Igual que arriba: solo el servidor puede enviar CSP. En dev/preview no se añadió CSP en Vite porque Vite inyecta scripts inline y una CSP estricta rompe el hot reload. |
| **HTTPS en producción** (app y API) | Infra / hosting / dominio | Configuración de red y TLS; no es código del frontend. |
| **Confirmar que el backend valida JWT y rol** en todas las rutas sensibles | Backend (revisión manual o tests) | Es responsabilidad del backend; el frontend no puede “cerrar” esto. |
| **Redirect URLs en Supabase** (recuperación de contraseña) | Dashboard de Supabase → Auth → URL Configuration | Configuración en la cuenta de Supabase; no está en el repo. |
| **No usar `dangerouslySetInnerHTML` sin sanitizar** | Código futuro | Recordatorio: al añadir features, no introducir este patrón con datos de usuario/API. |
| **Mantener dependencias actualizadas** | `npm update` / renovate / revisión periódica | Acción continua; no es un cambio único en el repo. |

**Resumen:** Lo que “falta” es o bien **configuración del servidor/hosting**, o bien **revisión/confirmación en backend o Supabase**, o bien **buenas prácticas a mantener** en el futuro. Nada de ello se puede “terminar” solo con código en este frontend.

---

## 12. Checklist de buenas prácticas (referencia futura)

- [ ] Backend valida JWT y rol en todas las rutas sensibles. *(Revisar en backend; ver tabla §11.)*
- [ ] Servir app y API solo por HTTPS en producción. *(Infra/hosting; ver tabla §11.)*
- [ ] No poner nunca secrets en `VITE_*`. *(Buenas prácticas al añadir envs.)*
- [ ] Mantener `.env` y `.env.local` fuera del repo. *(Buenas prácticas al desplegar.)*
- [x] Ejecutar `npm audit` (0 vulnerabilidades en última revisión); corregir altas/críticas si aparecen.
- [x] Headers de seguridad en Vite (dev/preview); [ ] CSP y mismos headers en servidor de producción *(servidor que sirve el frontend; ver §11 y SECURITY_HEADERS.md).*
- [ ] No usar `dangerouslySetInnerHTML` con datos de usuario/API sin sanitizar. *(Recordatorio para código futuro.)*
- [x] Redirect: `ProtectedRoute` valida `redirectTo`; usar `getSafeRedirectTo()` si se lee desde query params.
- [ ] Revisar Redirect URLs en Supabase para recuperación de contraseña. *(Dashboard Supabase; ver §11.)*
- [ ] Mantener @supabase/supabase-js y el resto de dependencias actualizadas. *(Acción periódica.)*

---

## 13. Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP SPA Security](https://cheatsheetseries.owasp.org/cheatsheets/SPA_Security_Cheat_Sheet.html)
- [Supabase Auth — Security](https://supabase.com/docs/guides/auth)
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

*Última actualización: aplicadas mejoras de hardening: timeout en fetchWithAuth, headers de seguridad en Vite, validación de redirect en ProtectedRoute, util getSafeRedirectTo, doc SECURITY_HEADERS.md para producción, checklist actualizado. Añadida sección 11 “Lo que falta y por qué” para revisión posterior. npm audit: 0 vulnerabilidades. La autorización y validación de datos deben residir siempre en el backend.*
