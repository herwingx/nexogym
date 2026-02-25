# Reglas de Interfaz y Experiencia de Usuario (UI/UX GUIDELINES)

Documento arquitectónico para el desarrollo del Frontend de NexoGym (PWA y Dashboards).

> El estado mental del usuario final dicta nuestra interfaz: El **Recepcionista** necesita velocidad extrema y cero fricción. El **Admin/SuperAdmin** necesita claridad analítica y confianza. El **Socio (Member)** necesita una experiencia móvil rápida y gamificada.

---

## 1. Estética Minimalista B2B (Estilo Vercel / Linear)

El objetivo de la plataforma es proyectar absoluta confianza, seguridad y modernidad. Alejándonos de diseños estridentes o genéricos, adoptamos un minimalismo técnico y elegante.

- **Tipografía:** Geométrica, limpia y de altísima legibilidad. Uso estricto de **Geist** o **Inter**.
- **Light/Dark Mode Dinámico:** Soporte nativo para ambos temas, permitiendo al usuario operar sin fatiga visual sin importar la iluminación de su entorno.

### Light Mode (Corporativo)
- Fondos blancos puros o `zinc-50`.
- Sombras ultra-suaves (`shadow-sm`) y bordes nítidos (`border-zinc-200`).
- Textos en `zinc-900`.

### Dark Mode (Profundo)
- Fondos `zinc-950` o negro puro (`#000000`).
- Bordes sutiles y elegantes (`border-white/10`).
- Textos en `zinc-100`.

---

## 2. White-Labeling y Accesibilidad WCAG (Color Math)

El SaaS es Multitenant. La interfaz debe adaptarse al color corporativo del gimnasio sin romper el diseño base ni la accesibilidad.

- **Inyección de Variables:** PROHIBIDO usar clases utilitarias estáticas de colores de marca. NUNCA usar `bg-blue-500` como color principal. Todo el color de marca se maneja mediante la variable CSS `--theme-primary`.
- **Color Math Dinámico (WCAG):** El sistema (vía la librería `colord`) evaluará matemáticamente la luminancia del color hexadecimal recibido del backend. Generará automáticamente una variable `--theme-primary-foreground` que será texto `#FFFFFF` (blanco) o `#000000` (negro) para garantizar siempre un contraste perfecto en los botones.
- **Acento Elegante:** El color de marca se usa como "acento" (para botones primarios, checks, y estados activos), no para rellenar fondos masivos.

---

## 3. Skeletons de Carga

Para que la carga de datos se perciba como más rápida y consistente, todas las vistas que dependen de datos asincrónicos (API) deben usar **skeletons** en lugar de un spinner genérico o campos en blanco.

- **Estilo:** Bloques con `bg-zinc-200 dark:bg-zinc-800` y `animate-pulse`, dentro de la misma estructura de cards/bordes que el contenido final.
- **Componentes:** Ver **`.docs/SKELETONS.md`** para la definición completa: cuándo usarlos, componentes disponibles (`Skeleton`, `CardSkeleton`, `TableRowSkeleton`, `ListSkeleton`) y lista de vistas que deben aplicarlos.

---

## 4. Librería de Microinteracciones y Componentes

### Botones (Buttons)

- **Primary:** `bg-primary text-primary-foreground hover:opacity-90 transition-opacity rounded-md px-4 py-2 font-medium shadow-sm`
- **Secondary / Outline:** `bg-transparent border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors rounded-md px-4 py-2`
- **States:**
  - `Disabled`: `opacity-50 cursor-not-allowed`
  - `Loading`: reemplazar ícono por spinner circular, manteniendo el ancho del botón.

### Inputs y Formularios

- **Base:** `bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow`

### Modales (Dialogs — Efecto "Acrylic Blur")

- **Overlay:** Fondo con `backdrop-blur-md bg-black/60` (Dark) o `bg-zinc-900/20` (Light).
- **Contenedor:** `bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-xl rounded-xl`. Animación de entrada suave (`fade-in`, `scale-95` a `scale-100`).

### Tarjetas (Cards / Bento Grids)

```
bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow
```

---

## 5. Check-in y Flujo "Hardware-First"

En horarios pico, el recepcionista no puede depender de un clic manual ni de encender webcams.

- **El Input Invisible (Hardware):** La pantalla de recepción debe incluir un `<input type="text">` estéticamente invisible (`opacity-0 absolute -z-10`) que mantenga un `autoFocus={true}` perpetuo. Si el input pierde el foco, un event listener `onBlur` debe recuperarlo en milisegundos. Esto permite que una pistola lectora QR (USB/Bluetooth) tipee el código y dispare el `Enter` automáticamente.
- **Lector por Cámara (Fallback):** La librería `html5-qrcode` (cámara del dispositivo) estará oculta detrás de un botón secundario ("Usar Cámara") para casos de emergencia o tablets.
- **Validación Visual:** Al escanear un QR válido, el sistema no solo registra el acceso, sino que **DEBE** disparar un Modal Acrílico mostrando en tamaño grande la Foto de Perfil y el nombre del socio, permitiendo al staff detener fraudes visualmente. El error `403` (Anti-passback) debe mostrarse claramente en rojo intenso.

---

## 6. Pantallas Requeridas por Módulo ERP

Las vistas se ocultan o muestran dinámicamente evaluando el store global `gym.modules_config`.

### Panel de Recepción (Rol: RECEPTIONIST)

| Pantalla | Descripción | Ruta sugerida |
|---|---|---|
| **Dashboard / Check-in** | Flujo Hardware-First para registrar entrada de socios | `/reception/checkin` |
| **POS** | Catálogo de productos (grid táctil), carrito y botón "Confirmar Venta" | `/reception/pos` |
| **Egresos** | Formulario rápido para sacar efectivo de la caja | `/reception/expenses` |
| **Abrir / Cerrar turno** | Formulario de fondo inicial y pantalla de reconciliación | `/reception/shift` |
| **Registrar socio** | Formulario de alta con soporte para capturar foto (cámara web/móvil) | `/reception/members/new` |

### Panel de Administración (Rol: ADMIN)

| Pantalla | Descripción | Ruta sugerida |
|---|---|---|
| **Dashboard principal** | Semáforo de ocupación + ingresos del día + socios activos | `/admin` |
| **Reporte financiero** | Selector de mes + desglose de ventas, egresos y ganancia neta | `/admin/finance` |
| **Socios** | Lista con filtros, estado de membresía y acciones | `/admin/members` |
| **Inventario** | Tabla de productos con stock actual + botones Restock y Merma | `/admin/inventory` |
| **Auditoría** | Tabla filtrable de `AuditLog` (Mermas, Cortesías, etc.) | `/admin/audit` |
| **Cortes de caja** | Historial de turnos con estado BALANCED / SURPLUS / SHORTAGE | `/admin/shifts` |

### Portal del Socio — PWA Móvil (Rol: MEMBER)

| Pantalla | Descripción | Ruta sugerida |
|---|---|---|
| **Home (Código QR)** | Código QR estático gigante + estado de membresía | `/` |
| **Gamificación** | Racha actual (fuego 🔥) + próximo premio | `/rewards` |
| **Historial** | Últimas visitas del socio | `/history` |

---

## 7. Componentes Clave de Negocio

### Tarjeta de Turno de Caja (POS)

Debe reflejar una interfaz financiera limpia:

```
┌─────────────────────────────────────────┐
│  TURNO ACTIVO          [Cerrar Turno]   │
│  Abierto: 08:00  ·  Fondo: $500.00      │
│  ─────────────────────────────────────  │
│  Ventas:    +$780.00                    │
│  Egresos:   -$50.00                     │
│  ─────────────────────────────────────  │
│  Esperado:  $1,230.00                   │
└─────────────────────────────────────────┘
```

- Ventas en verde sutil (`text-emerald-600 dark:text-emerald-400`).
- Egresos en rojo (`text-rose-600 dark:text-rose-400`).

### Badge de Estado de Membresía

Variantes de colores desaturados estilo Vercel:

```
ACTIVE  → bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20
EXPIRED → bg-rose-500/10    text-rose-600    dark:text-rose-400    border-rose-500/20
FROZEN  → bg-blue-500/10    text-blue-600    dark:text-blue-400    border-blue-500/20
```

### Fila de AuditLog (Tabla)

Acciones críticas como `COURTESY_ACCESS_GRANTED`, `INVENTORY_LOSS_REPORTED` o `SHIFT_CLOSED` con diferencia, deben resaltarse con un fondo `bg-rose-500/5` y un ícono de alerta visual.

---

## 8. Flujos de Notificación Visual (Sileo)

Toda interacción de éxito, error o envío de webhooks a n8n debe comunicarse mediante la librería **Sileo** (`sileo`).

Los "Toasts" deben configurarse globalmente para heredar el Dark/Light mode, usando bordes sutiles y fondo sólido:

```
bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/10 shadow-xl
```

| Acción | Estilo de Toast |
|---|---|
| Carga de datos | Spinner `"Sincronizando..."` |
| Socio creado | Success `"✓ WhatsApp de bienvenida enviado"` |
| Premio desbloqueado | Success `"🏆 Premio notificado al socio"` |
| Error Anti-Passback | Error `"El pase fue utilizado recientemente"` |

---

## Qué falta y por qué (revisión posterior)

Este doc son **reglas de interfaz**; lo que “falta” son cosas que no se definen aquí porque dependen de otro sitio o de aplicación continua:

| Qué no cubre este doc | Dónde está / quién lo hace | Por qué |
|------------------------|-----------------------------|--------|
| **Assets de diseño (Figma, iconos, ilustraciones)** | Herramienta de diseño o carpeta de assets en el repo | Este doc define estilos y patrones (colores, tipografía, componentes); los mockups y assets los define diseño o el equipo. |
| **Copy real de la app (textos, mensajes, errores)** | Código y/o ficheros de i18n | Las frases concretas que ve el usuario; pueden vivir en componentes o en archivos de traducción. |
| **Configuración de fuentes (Geist/Inter) en el build** | `index.html`, CSS o config de Vite/fonts | El doc pide Geist o Inter; asegurarse de que estén cargadas en el proyecto corresponde a quien configura el frontend. |
| **Aplicar estas reglas en cada pantalla nueva** | Al desarrollar cada vista | No hay “tarea única” que marque todo como hecho; cada pantalla nueva debe revisarse contra este doc (skeletons, botones, inputs, notificaciones Sileo). Ver SKELETONS.md para lista de vistas con skeleton. |
