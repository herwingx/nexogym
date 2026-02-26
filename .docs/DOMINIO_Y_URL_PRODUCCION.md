# Dominio y URL en Producción

Documento de referencia para entender cómo funciona el dominio, la URL y la marca en producción de NexoGym. Sirve como guía para despliegue y decisiones futuras (subdominios, dominios propios por gym).

---

## 1. Resumen ejecutivo

| Aspecto | Decisión actual |
|---------|-----------------|
| **Dominio** | Un solo dominio para app y API (ej. `app.nexogym.com`) |
| **Multitenancy por URL** | No. El tenant se identifica por sesión (usuario → gym), no por subdominio. |
| **White-label** | Marca visual (nombre, logo, colores del gym). La URL siempre lleva NexoGym; la experiencia del socio sí es white-label. |
| **Marca visible** | Socio: nombre del gym en PWA, título y tema. SuperAdmin / login: NexoGym. |

---

## 2. Arquitectura recomendada en producción

### 2.1 Dominio único + proxy

```
https://app.nexogym.com/          → SPA (frontend)
https://app.nexogym.com/api/v1/*  → proxy al backend (Node/Express)
```

**Por qué mismo origen:**
- La cookie `nexogym_gym_id` (para manifest dinámico y white-label PWA) se setea en el dominio del backend.
- Si frontend y API están en dominios distintos, el navegador no envía la cookie al pedir el manifest.
- Resultado: el diálogo "Instalar app" mostraría "NexoGym" en lugar del nombre del gym.

### 2.2 Configuración mínima

| Componente | Configuración |
|------------|---------------|
| **Servidor web** (nginx, Caddy, etc.) | Servir SPA en `/`, proxy de `/api/v1` al backend. |
| **Frontend build** | `VITE_API_BASE_URL` vacío o no definido en producción (rutas relativas `/api/v1`). |
| **CORS** | `CORS_ORIGIN` apuntando al dominio real (ej. `https://app.nexogym.com`). No usar `*` en producción. |
| **Cookie** | `secure: true`, `sameSite: lax`, dominio implícito (mismo origen). |

### 2.3 Diagrama simplificado

```
Usuario → https://app.nexogym.com
              ↓
         [Servidor Web]
              ├─ /          → SPA (index.html + assets)
              └─ /api/v1/*  → Backend Node.js
```

---

## 3. White-label: qué ve cada actor

### 3.1 Socio (MEMBER)

| Elemento | Valor |
|----------|-------|
| URL | `app.nexogym.com` (marca Nexo) |
| Título de pestaña | Nombre del gym |
| PWA instalada | Nombre del gym + `theme_color` del gym |
| Colores, logo | Del gym (`theme_colors`, `logo_url`) |
| Descripción PWA | "Portal del socio — {nombre del gym}" |

**Conclusión:** El socio percibe la app como del gimnasio, no de NexoGym. La URL no suele ser relevante porque la PWA se usa como app instalada.

### 3.2 Admin / Recepcionista / Coach (staff del gym)

| Elemento | Valor |
|----------|-------|
| URL | `app.nexogym.com` |
| Marca visible | Nombre del gym en layout y tema |
| Título | Nombre del gym |

### 3.3 SuperAdmin

| Elemento | Valor |
|----------|-------|
| URL | `app.nexogym.com/saas` |
| Marca visible | Siempre NexoGym (azul `#2563eb`) |
| Cookie `nexogym_gym_id` | No se setea (se limpia si existía) |
| Manifest | NexoGym (default) |

---

## 4. Referencias cruzadas

| Tema | Documento |
|------|-----------|
| Manifest dinámico y cookie | **PWA_MANIFEST_DINAMICO.md** |
| Checklist go-live | **GO_LIVE_CHECKLIST.md** (sección 2.2) |
| Variables de entorno prod | **GO_LIVE_CHECKLIST.md** (sección 3) |

---

## 5. Opciones futuras (no implementadas)

### 5.1 Subdominios por gym (ej. `fitzone.nexogym.com`)

| Pros | Contras |
|------|---------|
| URL única y memorable por gym | Requiere routing por host, identificar tenant por subdominio, DNS wildcard |
| Más branding por gym en la URL | Más complejidad DevOps y backend |

**Estado:** No implementado. Si se implementa, habría que:
- Añadir `subdomain` o `slug` al modelo `Gym`.
- Configurar `*.nexogym.com` en DNS y servidor.
- Resolver `req.hostname` en middleware para obtener el gym.

### 5.2 Dominio propio por gym (ej. `portal.fitzone.mx`)

| Pros | Contras |
|------|---------|
| White-label total en URL | CNAME por cliente, certificados SSL, proxy por dominio |
| Ideal para franquicias / Enterprise | Alta complejidad operativa |

**Estado:** No implementado. Considerar como feature de plan Enterprise o Self-Hosted.

### 5.3 Resumen de decisión

- **Lanzamiento:** Dominio único NexoGym + white-label visual. Suficiente para la propuesta de valor actual.
- **Subdominios / dominios propios:** Evaluar solo si hay demanda explícita o se ofrecen en planes superiores.

---

## 6. Checklist rápido para producción

- [ ] Un solo dominio para SPA y API (ej. `app.nexogym.com`).
- [ ] Proxy de `/api/v1` al backend en el servidor web.
- [ ] `VITE_API_BASE_URL` vacío o no definido en build de producción.
- [ ] `CORS_ORIGIN` configurado con el dominio real.
- [ ] Certificado SSL válido para el dominio.
- [ ] Probar instalación PWA: el nombre del gym debe aparecer en el diálogo "Instalar app" (no "NexoGym") cuando el usuario tiene sesión en un gym.

---

*Documento creado como referencia para estrategia de dominio y URL en producción. Actualizar si se implementan subdominios o dominios propios por gym.*
