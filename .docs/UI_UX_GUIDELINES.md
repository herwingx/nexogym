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

## 2. Paleta de Estados (semántica fija)

Los estados (suscripción, cortes de caja, inventario, etc.) usan una paleta interna normalizada. Importar desde `lib/statusColors.ts`:

| Semántica   | Uso                    | Clases / Constante              |
|-------------|------------------------|----------------------------------|
| success     | Activo, correcto       | `STATUS_BADGE.success` (emerald) |
| danger      | Error, expirado, faltante | `STATUS_BADGE.danger` (rose)  |
| warning     | Advertencia, pendiente, sobrante | `STATUS_BADGE.warning` (amber) |
| info        | Informativo, congelado | `STATUS_BADGE.info` (blue)      |
| neutral     | Cancelado, neutro      | `STATUS_BADGE.neutral` (zinc)   |
| inactive    | Deshabilitado          | `STATUS_BADGE.inactive` (zinc apagado) |

Para botones outline de acción destructiva: `STATUS_BUTTON_DANGER_OUTLINE`. Para badges de tabla con ícono: `BADGE_BASE` + variante. Nunca hardcodear colores de estado; usar siempre la paleta.

---

## 3. White-Labeling y Accesibilidad WCAG (Color Math)

El SaaS es Multitenant. La interfaz debe adaptarse al color corporativo del gimnasio sin romper el diseño base ni la accesibilidad.

- **Inyección de Variables:** PROHIBIDO usar clases utilitarias estáticas de colores de marca. NUNCA usar `bg-blue-500` como color principal. Todo el color de marca se maneja mediante la variable CSS `--theme-primary`.
- **Botones de peligro (eliminar, dar de baja):** SIEMPRE usar `rose-500/600` para texto, bordes y hover. NUNCA personalizar con `--theme-primary`. Denotan peligro y deben mantener el rojo semántico en todo momento.
- **Color Math Dinámico (WCAG):** El sistema (vía la librería `colord`) evaluará matemáticamente la luminancia del color hexadecimal recibido del backend. Generará automáticamente una variable `--theme-primary-foreground` que será texto `#FFFFFF` (blanco) o `#000000` (negro) para garantizar siempre un contraste perfecto en los botones.
- **Acento Elegante:** El color de marca se usa como "acento" (para botones primarios, checks, y estados activos), no para rellenar fondos masivos.
- **PWA (instalación):** El manifest es dinámico: al instalar la app en el dispositivo, el nombre y el color mostrados son los del gym (white-label). Ver **PWA_MANIFEST_DINAMICO.md**.
- **Quién personaliza:** El **Admin** edita el color de acento en Mi perfil → Color de acento del gimnasio (con vista previa del contraste). El Super Admin no elige colores en el alta; la app se entrega "en stock" con color por defecto. Super Admin puede editar colores de un gym desde el panel (Editar gym) si necesita hacerlo.

---

## 4. Skeletons de Carga

Para que la carga de datos se perciba como más rápida y consistente, todas las vistas que dependen de datos asincrónicos (API) deben usar **skeletons** en lugar de un spinner genérico o campos en blanco.

- **Estilo:** Bloques con `bg-zinc-200 dark:bg-zinc-800` y `animate-pulse`, dentro de la misma estructura de cards/bordes que el contenido final.
- **Componentes:** Ver **`.docs/SKELETONS.md`** para la definición completa: cuándo usarlos, componentes disponibles (`Skeleton`, `CardSkeleton`, `TableRowSkeleton`, `ListSkeleton`) y lista de vistas que deben aplicarlos.

---

## 5. Librería de Microinteracciones y Componentes

### Botones (Buttons)

- **Primary:** `bg-primary text-primary-foreground hover:opacity-90 transition-opacity rounded-md px-4 py-2 font-medium shadow-sm`
- **Secondary / Outline:** `bg-transparent border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors rounded-md px-4 py-2`
- **Danger (eliminar, dar de baja):** `bg-rose-500 text-white hover:bg-rose-600` — Siempre texto blanco sobre fondo rojo para contraste; nunca usar `--theme-primary`. Variante `variant="danger"` del componente Button.
- **States:**
  - `Disabled`: `opacity-50 cursor-not-allowed`
  - `Loading`: reemplazar ícono por spinner circular, manteniendo el ancho del botón.

### Inputs y Formularios

- **Base:** `bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow`

### Modales (Dialogs — Efecto "Acrylic Blur")

- **Overlay:** Fondo con `backdrop-blur-md bg-black/60` (Dark) o `bg-zinc-900/20` (Light).
- **Contenedor:** `bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-xl rounded-xl`. Animación de entrada suave (`fade-in`, `scale-95` a `scale-100`).
- **Botón cerrar:** Usar siempre el componente `ModalCloseButton` (`components/ui/ModalCloseButton.tsx`). Garantiza ícono X consistente, microanimación (hover/active) y variantes `default` (modales claros) / `dark` (fondos oscuros, ej. escáner cámara). El componente `Modal` ya lo incluye; modales custom (CheckInModal, CameraScanner) deben importarlo y usarlo en lugar de implementar un X propio.

### Layouts y headers (White-label)

- **Logo del gym:** Los layouts Admin, Reception y Member muestran el logo (`gymLogoUrl` del store) en el header cuando existe. Contenedor: `h-8 w-8` o `h-9 w-9`, borde sutil, `object-contain`. Si no hay logo, solo el nombre del gym.
- **Header bar (Admin):** Barra de breadcrumb `h-14`, `flex items-center`, padding horizontal `pl-4 pr-4`. Breadcrumb con `compact` y `py-0` para alineación vertical correcta.
- **Consistencia:** Mismo estilo de logo en sidebar Admin, topbar Reception y header Member (contenedor redondeado, borde, fondo).

### Tarjetas (Cards / Bento Grids)

```
bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow
```

---

## 6. Check-in y Flujo "Hardware-First"

En horarios pico, el recepcionista no puede depender de un clic manual ni de encender webcams.

- **Input para lector de barras/QR (Hardware):** El componente `HardwareScanner` puede usarse en dos modos: (1) **Invisible** (Check-in): input con `opacity-0` y foco perpetuo para pistola USB que actúa como teclado; un badge "Listo para escanear" (verde) indica que el panel está esperando lecturas; (2) **Visible** (POS): input visible con placeholder para escritura manual o pistola. En ambos casos, el foco se recupera en `onBlur` salvo cuando hay modales abiertos (`pauseFocus`).
- **Lector por Cámara (Fallback):** Implementado con `html5-qrcode`. El botón "Usar cámara" abre un modal a pantalla completa que usa la cámara del dispositivo (PC, tablet o móvil). Al escanear un QR válido se procesa el check-in automáticamente. Pensado para gimnasios sin pistola USB o para operar desde el teléfono.
- **Validación Visual:** Al escanear un QR válido, el sistema no solo registra el acceso, sino que **DEBE** disparar un Modal Acrílico mostrando en tamaño grande la Foto de Perfil y el nombre del socio, permitiendo al staff detener fraudes visualmente. El error `403` (Anti-passback) debe mostrarse claramente en rojo intenso.

---

## 7. Pantallas Requeridas por Módulo ERP

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
| **Dashboard principal** | Ventas del mes + ganancia neta; **semáforo de ocupación** solo si el gym tiene Check-in QR (`qr_access`). En plan Basic no se muestra ocupación. | `/admin` |
| **Check-in** | Enlace en el sidebar que lleva a la vista de recepción (`/reception`) para hacer check-in (el admin tiene los mismos permisos que recepcionista en backend). | Sidebar → Check-in → `/reception` |
| **Reporte financiero** | Selector de mes + desglose de ventas, egresos y ganancia neta | `/admin/finance` |
| **Socios** | Búsqueda por nombre/teléfono, listado paginado, columnas Nombre/Teléfono/Estado/Plan/Vence, acciones renovar/congelar/descongelar (y solo Admin: cancelar, regenerar QR). Misma UX en Recepción. | `/admin/members` |
| **Inventario** | Tabla de productos con stock actual + botones Restock y Merma | `/admin/inventory` |
| **Auditoría** | Registro de acciones críticas (etiquetas en español): turno cerrado, personal dado de alta, suscripción renovada, etc. Filtrable por tipo. | `/admin/audit` |
| **Cortes de caja** | Historial de turnos con estado Cuadrado / Sobrante / Faltante; por turno, Transacciones (ventas por folio con desglose por producto) | `/admin/shifts` |
| **Clases** | Crear, editar y eliminar clases grupales. Día, hora, instructor, cupo, costo opcional. Socios ven clases en su portal y pueden reservar/cancelar. Ver **CLASES_GRUPALES.md**. | `/admin/classes` |
| **Gamificación** | Configuración de premios por racha: hitos (días) y texto del premio. Solo visible si el plan tiene módulo gamificación. | `/admin/rewards` |

### Portal del Socio — PWA Móvil (Rol: MEMBER)

| Pantalla | Descripción | Ruta sugerida |
|---|---|---|
| **Home (Código QR)** | Código QR estático gigante + estado de membresía | `/` |
| **Clases** | Ver horarios por día/fecha, reservar lugar, cancelar reserva; ver costo si la clase es externa o especial. Solo visible si el gym tiene módulo `classes`. | `/member/classes` |
| **Gamificación** | Racha actual (fuego 🔥), mensaje "Estás participando por racha para los siguientes premios" con lista del gym, próximo premio e hitos (configurables por gym o por defecto) | `/member/rewards` |
| **Historial** | Últimas visitas del socio | `/member/history` |

---

## 8. Componentes Clave de Negocio

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

Usar `STATUS_BADGE` desde `lib/statusColors.ts`:

| Estado | Constante | Ejemplo |
|--------|-----------|---------|
| ACTIVE | `STATUS_BADGE.success` | Activo |
| EXPIRED | `STATUS_BADGE.danger` | Expirado |
| FROZEN | `STATUS_BADGE.info` | Congelado |
| CANCELED | `STATUS_BADGE.neutral` | Cancelado |
| PENDING_PAYMENT | `STATUS_BADGE.warning` | Pendiente de pago |

### Badge de Estado de Corte (Cortes de caja)

Usar `BADGE_BASE`, `STATUS_BADGE` y `STATUS_BADGE_BORDER` desde `lib/statusColors.ts`:

- **Cuadrado** (balance correcto): `STATUS_BADGE.success`
- **Sobrante** (hay más de lo esperado): `STATUS_BADGE.warning`, ícono TrendingUp
- **Faltante** (hay menos de lo esperado): `STATUS_BADGE.danger`, ícono TrendingDown

`BADGE_BASE` incluye `whitespace-nowrap` para mantener la columna alineada.

### Fila de AuditLog (Tabla)

Acciones críticas como `COURTESY_ACCESS_GRANTED`, `INVENTORY_LOSS_REPORTED` o `SHIFT_CLOSED` con diferencia, deben resaltarse con un fondo `bg-rose-500/5` y un ícono de alerta visual.

---

## 9. Flujos de Notificación Visual (Sileo)

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
