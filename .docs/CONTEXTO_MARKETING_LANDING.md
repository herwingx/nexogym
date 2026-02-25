# Contexto Estratégico y Copywriting para Landing Page (NexoGym)

Documento de referencia con **identidad de marca**, **buyer personas**, **beneficios por plan**, **copy** y **detalle de producto** para el sitio de marketing y la landing page.

---

## 1. Identidad de Marca y Posicionamiento

- **Nombre del Producto:** NexoGym
- **Categoría:** ERP B2B Multitenant / Sistema Operativo para Gimnasios
- **Estética de Marca:** Premium, minimalista — estilo Vercel / Apple / Linear. Colores neutros (blanco, negro, zinc) con un color de acento
- **Tono de Voz:** Profesional, seguro, tecnológico, directo al grano. Hablamos de *proteger el dinero*, *automatizar* y *escalar*; no de “sudar” o “ponerse fuerte”
- **Promesa Principal (Value Proposition):** *"El sistema operativo definitivo para escalar tu gimnasio. Cero robos, cero fricción, control total."*
- **Propuesta de Valor Única (USP):** *"NexoGym no es solo un software de administración, es un sistema operativo antifraude que opera bajo tu propia marca y convierte a tus socios en adictos a entrenar."*
- **Tagline alternativo:** *Conecta al dueño, al staff y a los clientes.*

**Nota técnica:** SaaS multitenant (cada gimnasio es un tenant aislado). Stack: Node.js 18+, TypeScript 5, Express 5, PostgreSQL (Supabase), Prisma 7, Supabase Auth, Vitest, CI con GitHub Actions.

---

## 2. SEO y Metadatos

- **Title Tag Sugerido:** NexoGym | Software y Control de Acceso para Gimnasios
- **Meta Description:** Sistema ERP para gimnasios y estudios. Controla tu punto de venta, automatiza el acceso por QR o biometría, y evita el robo hormiga. Administra tu negocio desde cualquier lugar.
- **Keywords Principales:** software para gimnasios, control de acceso gym, sistema punto de venta gimnasio, evitar robo en gimnasio, software membresías gym, control de torniquetes ZKTeco, ERP fitness Latam

---

## 3. Target Audience y Buyer Personas

### ¿Quién es nuestro cliente? (Target Audience)

Dueños de gimnasios, estudios de fitness, CrossFit y centros deportivos que están cansados de usar Excel, cuadernos o software genérico que se traba, que permite fraudes en la recepción y que no les ayuda a retener clientes.

### Buyer Personas (A quién le vendemos)

| Persona | Perfil | Dolor / Necesidad | Solución NexoGym |
|--------|--------|--------------------|------------------|
| **El Dueño Tradicional (Transición digital)** | Gym de barrio, anota todo en libreta o Excel | Le roban en caja y no sabe quién entra | Plan **Básico** o **Pro** |
| **El Dueño de Estudio (Yoga / CrossFit / Funcional)** | Le importa la experiencia del cliente | Reservas de clases, aforo limitado, verse moderno | Plan **Pro** |
| **El Inversor / Franquicia (Gym 24/7)** | No está en el gimnasio; torniquetes físicos | Métricas globales, auditar empleados a distancia | Plan **Élite** o Self-Hosted |

**Roles dentro del producto:** Dueño/gerente (Admin), recepcionista, instructor/coach, socio (portal PWA). Cada uno con su vista y permisos.

---

## 4. Los 5 Pilares de Funcionalidad (Hero, Bento Grid, Beneficios)

Dolor del cliente + solución NexoGym. Usar estos puntos para los textos del Hero, el Bento Grid y la sección de Beneficios.

---

### Pilar 1: Acceso Anti-Fraude (Check-in ultrarrápido)

**El dolor:** Los socios se prestan la tarjeta, entran dos por uno, o el sistema se cuelga en hora pico (6:00 PM) haciendo filas enormes.

**La solución NexoGym:** Lectura de código QR en ~100 ms (Hardware-First). Sistema Anti-Passback automático de 4 horas (si alguien le pasa su QR por la ventana a un amigo, el sistema marca rojo intenso). Validación visual gigante en pantalla para que el recepcionista vea la foto del titular.

---

### Pilar 2: Caja Blindada (Punto de venta y cierres ciegos)

**El dolor:** Robos hormiga. El recepcionista ve que sobran $200 pesos en el sistema y se los guarda al final del día.

**La solución NexoGym:** Cierre ciego (Blind Close). El recepcionista nunca ve cuánto dinero "debería" haber en caja. Solo cuenta los billetes, ingresa el monto, y el sistema te avisa a ti (el dueño) si hay faltantes. Separación estricta de gastos operativos vs. pagos a proveedores.

---

### Pilar 3: Gamificación y Retención (App del socio)

**El dolor:** Los socios se desmotivan y cancelan su membresía al tercer mes.

**La solución NexoGym:** Una Web App instalable (PWA) para cada socio. Sistema de recompensas basado en "Rachas de Fuego" (Streaks). Si el socio viene a entrenar días seguidos, su racha aumenta — psicología de retención estilo Duolingo.

---

### Pilar 4: Marca Blanca Real (White-label)

**El dolor:** Las apps de los gimnasios siempre llevan el logo de la empresa de software; el gimnasio se ve barato.

**La solución NexoGym:** Tu gimnasio, tu marca. El sistema adapta colores, botones y contrastes (matemáticamente, WCAG) al color exacto de la marca del gym. El socio siente que es una app premium exclusiva de su centro.

---

### Pilar 5: Control de Personal (Roles estrictos)

**El dolor:** El instructor de pesas de repente está cobrando membresías y el cajero borra rutinas. Desorden total.

**La solución NexoGym:** Vistas y permisos aislados. El Coach solo ve rutinas y aforo. El Recepcionista solo ve el escáner y la caja. El Dueño (Admin) ve todo, incluidos reportes de auditoría en tiempo real.

---

## 5. Diferenciadores Clave (Killer Features — resumen)

- **Seguridad Anti-Passback y Validación Visual:** No más préstamos de membresía. El código QR estático bloquea entradas dobles por 4 horas y lanza una foto gigante del socio en la pantalla de recepción.
- **Check-in "Hardware-First":** Optimizado para la vida real. Recepción ultrarrápida con pistolas lectoras USB; cero clics, cero retrasos en horas pico.
- **Cero Robo Hormiga (AuditLog):** Registro inborrable de mermas de inventario, descuadres de caja y accesos de "cortesía" dados por el staff.
- **Automatización por WhatsApp:** Bienvenidas, recordatorios y premios de gamificación enviados automáticamente al WhatsApp del cliente (Powered by n8n).

---

## 6. Estructura de Precios y Escalabilidad (SaaS Tiers)

NexoGym crece con el negocio del cliente. Mostrar planes claros (**Mensual / Anual**).

**Beneficios a destacar en los planes:** Multi-sucursal (multitenant), envíos automáticos de felicitaciones de cumpleaños por WhatsApp (vía n8n), reportes financieros detallados y soporte VIP (según plan).

**Nombres en producto (API/DB):** Básico = `BASIC`, Pro = `PRO_QR`, Élite = `PREMIUM_BIO`.

---

### Plan Básico: "Control y Caja"

*Para gimnasios que necesitan formalizar sus finanzas y abandonar el Excel.*

- **CRM completo:** Alta de socios y captura de fotografías
- **Control de acceso manual:** Búsqueda rápida por nombre/teléfono
- **Punto de venta (POS):** Catálogo de productos, control de stock y mermas
- **Gestión financiera:** Apertura, cierre y reconciliación de turnos de caja (cierre ciego para recepcionistas; admin ve esperado/real)
- **Restricción de horarios:** Planes económicos (ej. "Plan Matutino: 06:00 a 12:00")
- **White-label:** Logo y colores del gym
- **Personal:** Listado de staff y dar de baja (soft delete)
- **Auditoría:** Registro de acciones relevantes

---

### Plan Pro: "Automatización y Experiencia"

*Para estudios modernos y dueños que quieren que el gimnasio opere solo.*

*Todo lo del Plan Básico, más:*

- **Acceso inteligente:** Check-in por código QR estático (único por socio, enviado por WhatsApp)
- **Seguridad activa:** Validación visual con foto gigante y bloqueo Anti-Passback de 4 horas
- **WhatsApp integrado:** Envío automático de bienvenida con código de acceso (n8n)
- **Clases y reservas:** Gestión de horarios, control de aforo y reservas desde el celular (portal socio)
- **Motor de retención (gamificación):** Rachas de asistencia y recompensas automáticas
- **Rutinas digitales:** Asignación de ejercicios (series, repeticiones, peso) desde la plataforma; el socio las ve en su portal

---

### Plan Élite: "Seguridad y Control Físico"

*Para gimnasios de alto flujo, 24/7 y dueños corporativos.*

*Todo lo del Plan Pro, más:*

- **Integración biométrica (IoT):** Conexión directa con torniquetes y lectoras faciales/huella (compatible con ZKTeco vía API Key)
- **Apertura de puertas autónoma:** El sistema evalúa vigencia y Anti-Passback y abre el torniquete sin intervención humana
- **Auditoría avanzada:** Acceso total al registro de acciones del staff (quién dio cortesías, quién reportó mermas)
- **Reportes financieros:** Ganancia neta (Ventas - Egresos) y comisiones por vendedor

---

### Tabla comparativa rápida (para landing)

| Funcionalidad | Básico | Pro | Élite |
|---------------|--------|-----|-------|
| POS, inventario, cortes de caja | ✅ | ✅ | ✅ |
| Check-in manual | ✅ | ✅ | ✅ |
| Check-in por QR + validación visual + Anti-Passback | ❌ | ✅ | ✅ |
| WhatsApp (bienvenida, QR) | ❌ | ✅ | ✅ |
| Clases y reservas | ❌ | ✅ | ✅ |
| Gamificación (rachas y premios) | ❌ | ✅ | ✅ |
| Rutinas digitales | ❌ | ✅ | ✅ |
| Check-in biométrico / torniquetes (ZKTeco) | ❌ | ❌ | ✅ |
| White-label, personal, auditoría | ✅ | ✅ | ✅ |

---

## 7. Opciones de Nivel Corporativo (Enterprise / One-Time)

### Plan Personalizado (Enterprise SaaS)

*Para cadenas de gimnasios con múltiples sucursales.*

- Todo lo del plan Élite
- Base de datos aislada (Dedicated Database)
- Funciones a medida (integración con ERPs contables, migración de datos complejos)
- SLAs de disponibilidad 99.9%
- Soporte técnico prioritario 24/7
- *Precio: Cotización a medida (MRR alto)*

### Licencia Perpetua (Self-Hosted / On-Premise)

*Para corporativos con infraestructura IT propia o dueños que rechazan la suscripción.*

- **Un solo pago (One-Time Fee):** Sin pagos mensuales por software
- **Propiedad de los datos:** Instalación en servidor local del cliente (VPS, Proxmox, AWS propio)
- **Entrega "llave en mano":** Instalación inicial, configuración de red y puesta en marcha por NexoGym

**Términos de soporte:**

- **No incluye soporte continuo.** Una vez instalado y probado, la infraestructura, seguridad de red, backups, mantenimiento del servidor y resolución de caídas por hardware son **100% responsabilidad del cliente**.
- Actualizaciones futuras del sistema o asistencia técnica por fallos se cobran por evento (consultoría por horas).

*Ideal para: Clientes con ingeniero de sistemas propio o que prefieren pagar una vez y asumir el mantenimiento.*

---

## 8. Llamados a la Acción (CTA)

Objetivo: que el dueño del gimnasio sienta **urgencia** y **confianza**.

| Tipo | Texto | Uso |
|------|------|-----|
| **CTA principal** | *"Comenzar Prueba Gratuita de 14 días"* | Botón hero, conversión estándar |
| **CTA secundario** | *"Agendar Demostración"* | Para clientes más grandes; conectar con chatbot de IA para pre-calificarlos |

---

## 9. Preguntas Frecuentes (FAQ Landing Page)

1. **¿Qué pasa si me quedo sin internet?**  
   NexoGym es un sistema en la nube de alta velocidad. Requiere conexión a internet estable. Para accesos biométricos de emergencia, recomendamos hardware con memoria caché interna temporal.

2. **¿Necesito comprar webcams caras para leer los códigos QR?**  
   No. NexoGym está diseñado con arquitectura "Hardware-First". Recomendamos pistolas lectoras de QR por USB (menos de ~20 USD). Son más rápidas, no requieren configuración compleja y el sistema las lee al instante.

3. **¿El sistema avisa si alguien le pasa su código a un amigo?**  
   Sí. Tecnología Anti-Passback: bloquea reingresos antes de 4 horas. Además, la foto de perfil del socio se muestra en pantalla en recepción para validación visual.

4. **¿Qué pasa si mi recepcionista no cierra caja?**  
   No puede cerrar sesión sin hacer corte. Si se va sin cerrar, el admin puede forzar el cierre del turno desde el panel.

5. **¿Los socios tienen que instalar una app?**  
   No. Pueden entrar con el QR enviado por WhatsApp. La PWA es opcional (ver rachas, reservar clases, reenviar QR).

---

## 10. Mensajes Clave para la Landing

### Headlines sugeridos

- *El sistema operativo definitivo para escalar tu gimnasio.*
- *Cero robos, cero fricción, control total.*
- *Todo tu gym en una sola plataforma.*
- *Conecta recepción, caja, clases y socios. Sin papeles.*

### Beneficios en bullets (copy)

- **Control de caja:** Turnos por recepcionista, cierre ciego, egresos tipados, forzar cierre si hace falta
- **Entrada flexible:** Manual, QR estable (WhatsApp) o huella; validación visual y Anti-Passback
- **Socios en el centro:** Portal PWA con perfil, historial, QR, rachas, premios y reserva de clases
- **Operación diaria:** POS, inventario en tiempo real, clases con cupo, rutinas digitales
- **Tu marca:** Logo y colores por gym (white-label)
- **Seguridad y trazabilidad:** Auditoría, roles, multitenant; cada gym ve solo sus datos

---

## 11. Detalle de Módulos (referencia para copy y desarrollo)

Resumen técnico por área para redactar o implementar.

| Área | Incluye |
|------|--------|
| **POS y caja** | Ventas, turnos por recepcionista, cierre ciego, egresos tipados (proveedor / operativo / retiro), forzar cierre (admin), bloqueo de logout sin corte |
| **Inventario** | Productos, stock en tiempo real (se descuenta al vender), restock, mermas |
| **Check-in** | Manual, QR estático (WhatsApp), biométrico (Élite); validación visual (nombre + foto); Anti-Passback 4 h; restricción horaria; cortesías |
| **Socios** | Alta, foto, PIN, estados (ACTIVE, EXPIRED, FROZEN, CANCELED), renovar, congelar/descongelar, QR estable |
| **Clases** | Horarios por día, cupo, instructor; reservas desde PWA; marcado de asistencia |
| **Rutinas** | Asignación por staff; ejercicios con series, repeticiones, peso; el socio las ve en el portal |
| **Gamificación** | Rachas por día; premios por hitos (config por gym); notificación por WhatsApp |
| **Personal** | Roles (Admin, Recep, Coach, Instructor, Socio); listado staff; dar de baja (soft delete) |
| **Mensajería** | n8n: welcome, resend_qr, reward, shift_summary (WhatsApp u otro canal) |
| **SaaS Admin** | Multitenant; panel SuperAdmin; métricas globales; planes y override de módulos |

---

## 12. Referencias Técnicas Internas

Para profundizar en flujos y APIs (desarrollo, no copy):

| Tema | Documento |
|------|------------|
| Módulos y permisos por plan | [SEED_USERS_AND_ROLES.md](./SEED_USERS_AND_ROLES.md) |
| Cortes de caja, stock, cierre ciego | [CORTES_CAJA_Y_STOCK.md](./CORTES_CAJA_Y_STOCK.md) |
| QR del socio, reenviar, regenerar | [MEMBER_QR_ACCESS.md](./MEMBER_QR_ACCESS.md) |
| Suscripciones: renovar, congelar, sync | [SUBSCRIPTION_EXPIRY_AND_RENEWAL.md](./SUBSCRIPTION_EXPIRY_AND_RENEWAL.md) |
| API y contratos | [API_SPEC.md](./API_SPEC.md) |
| Índice de documentación | [README.md](./README.md) |

---

*Documento fusionado para marketing y landing de NexoGym. Incluye: identidad, USP, target audience, buyer personas, 5 Pilares (dolor/solución para Hero y Bento), diferenciadores, precios y escalabilidad (Mensual/Anual), beneficios por plan, Enterprise, Self-Hosted, CTAs, FAQ y detalle de módulos. Actualizar al añadir funcionalidades o planes.*
