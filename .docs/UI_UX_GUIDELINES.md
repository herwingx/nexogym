# Reglas de Interfaz (UI_UX_GUIDELINES)

Actualizado tras la implementación del ERP Full (Sprints B1–B9).

Este documento contiene directrices obligatorias para la estética, accesibilidad e interfaces generadas tanto para la aplicación móvil progresiva (Portal de Clientes), como el tablero de administración de escritorio.

## Estética "Cyberpunk / Lo-Fi" (OBLIGATORIA)
El objetivo de la plataforma es no parecer ni de lejos un software "corporativo" (Evita azules estándar, grises insípidos y fondos blancos predeterminados).

1. **Dark Mode Profundo**
   - El tema de fondo universal no es completamente negro, es extremadamente oscuro, por ejemplo, `#0a0a0a` o un `zinc-950` casi absoluto con algo de tintado.
   - Todo el texto general debe estar en escalas de grises claros (`gray-300`, `gray-400`).

2. **Cristalmorfismo (Glassmorphism)**
   - Paneles flotantes flotantes, top-bars de navegación y modales de confirmación o alerta siempre deben usar utilidades de difuminado del fondo de css (`backdrop-blur-md` a `backdrop-blur-xl`) así como un ligero fondo semi transparente con blanco al 5% o 10% (ej. `bg-white/5`).
   - Todos los bordes de componentes como tarjetas de precios de POS o cajas de suscripción usan radio grande, típicamente `rounded-xl` o `rounded-2xl`.

3. **Acentos Brillantes (Tono Neón)**
   - Usa sombras extendidas de colores vibrantes (`shadow-lg shadow-theme-accent/50`) para dar impacto a los botones clave (Ej: El botón primario de "Abrir Caja" o "Escanear QR").

---

## White-Labeling Dinámico: La Regla del Color Dinámico
El SaaS es Multitenant en su diseño para cada gimnasio, lo que prohíbe fuertemente setear variables absolutas en tailwind (ej, no escribas NUNCA `bg-blue-500` para un fondo principal).

- **Cómo hacerlo:** Usa Variables CSS inyectadas.
  ```html
  <!-- Ejemplo Prohibido -->
  <button className="bg-red-500 text-white rounded-xl">Entrar</button>

  <!-- Ejemplo Obligatorio de White-Labeling -->
  <button className="bg-theme-primary text-white rounded-xl">Entrar</button>
  ```
- **Nota técnica:** Las variables CSS globales como `--theme-primary` y `--theme-accent` son devueltas en la conexión API y almacenadas en el estado global (Zustand) para ser inyectadas en la etiqueta `<body>` o de raíz dinámicamente, lo cual Tailwind toma con una extensión simple en su configuración de variables.

---

## Componentes y Layouts Adaptativos Híbridos
El diseño de interfaces está en el núcleo de un abordaje de "Mobile-First":

1. **Dispositivos Móviles (Clientes / Portal PWA)**
   - Barra de Navegación Inferior (Bottom Navigation Bar) fijada a toda costa en el final de las pantallas táctiles.
   - Todas las llamadas a la acción deben ser de buen tamaño táctil (Padding mínimo de 3 a 4 rem `py-3 px-4`).

2. **Escritorio (Panel de Administración Admin/Recepción)**
   - Se debe utilizar un Layout con un "Sidebar" vertical colapsable lateral a la izquierda.
   - Optimización de tablas para mostrar bases de datos extensas.

---

## Escaneo de Códigos QR
Dado que no requerimos hardware propietario caro como torniquetes:
1. **Lector por Cámara (Móvil):** La app del recepcionista incorpora el componente de JavaScript libre de dependencias pesadas `html5-qrcode` para disparar el lector desde la cámara del celular.
2. **Lector de Hardware (PC Desktop USB):** La configuración del lector asume que el escáner escribe como un teclado USB directo con un "Enter" final. Por defecto, en el panel de recepción siempre hay un campo tipo `input` oculto temporalmente u opacado que forza foco infinito (`autoFocus={true}` + `onBlur={(e) => e.target.focus()}`) en background para nunca perder una lectura del torniquete.

---

## Pantallas Requeridas por Módulo ERP

### Panel de Recepción (Rol: RECEPTIONIST)

| Pantalla | Descripción | Ruta sugerida |
|---|---|---|
| **Dashboard turno** | Estado del turno activo: fondo inicial, ventas acumuladas, egresos | `/reception` |
| **Check-in** | Campo de PIN / lector QR / cámara para registrar entrada de socios | `/reception/checkin` |
| **POS** | Catálogo de productos con botones grandes táctiles, carrito y botón "Confirmar Venta" | `/reception/pos` |
| **Egresos** | Formulario rápido: monto + descripción para sacar efectivo de la caja | `/reception/expenses` |
| **Abrir / Cerrar turno** | Formulario de fondo inicial y pantalla de cierre con reconciliación | `/reception/shift` |
| **Registrar socio** | Formulario de alta con auto-generación de PIN | `/reception/members/new` |

### Panel de Administración (Rol: ADMIN)

| Pantalla | Descripción | Ruta sugerida |
|---|---|---|
| **Dashboard principal** | Semáforo de ocupación + ingresos del día + socios activos | `/admin` |
| **Reporte financiero** | Selector de mes + desglose de ventas, egresos y ganancia neta | `/admin/finance` |
| **Socios** | Lista con filtros, estado de membresía y acciones (renovar, congelar, cortesía) | `/admin/members` |
| **Inventario** | Tabla de productos con stock actual + botones Restock y Merma | `/admin/inventory` |
| **Auditoría** | Tabla filtrable de `AuditLog`: cortesías, mermas, cortes con descuadre | `/admin/audit` |
| **Cortes de caja** | Historial de turnos con estado BALANCED / SURPLUS / SHORTAGE | `/admin/shifts` |

### Portal del Socio — PWA Móvil (Rol: MEMBER)

| Pantalla | Descripción | Ruta sugerida |
|---|---|---|
| **Home** | Racha actual + estado de membresía + próximo premio | `/` |
| **Mi QR** | Código QR grande para escanear en recepción | `/qr` |
| **Historial** | Últimas visitas del socio | `/history` |

---

## Componentes Clave del ERP

### Tarjeta de Turno de Caja
```
┌─────────────────────────────────────────┐
│  TURNO ACTIVO          [Cerrar Turno]   │
│  Abierto: 08:00  ·  Fondo: $500.00     │
│  ─────────────────────────────────────  │
│  Ventas:    +$780.00                    │
│  Egresos:   -$50.00                     │
│  ─────────────────────────────────────  │
│  Esperado:  $1,230.00                   │
└─────────────────────────────────────────┘
```
- Fondo glassmorphism + borde `theme-accent`
- Ventas en verde neón, egresos en rojo/rosa

### Badge de Estado de Membresía
```
ACTIVE    → bg-green-500/20  · text-green-400  · border-green-500/30
EXPIRED   → bg-red-500/20    · text-red-400    · border-red-500/30
FROZEN    → bg-blue-500/20   · text-blue-400   · border-blue-500/30
CANCELED  → bg-zinc-500/20   · text-zinc-400   · border-zinc-500/30
```

### Semáforo de Ocupación
```
VACÍO  (0 personas)   → Punto verde pulsante
NORMAL (1-20)         → Punto amarillo pulsante
LLENO  (21+)          → Punto rojo pulsante con advertencia
```
El punto usa `animate-pulse` de Tailwind. El color se mapea a `text-theme-accent`.

### Fila de AuditLog (tabla)
- Acciones críticas (`COURTESY_ACCESS_GRANTED`, `INVENTORY_LOSS_REPORTED`, `SHIFT_CLOSED` con diferencia ≠ 0) deben resaltarse con `bg-red-500/10` y un ícono de alerta.
- El campo `details` (JSONB) se expande en un `<details>` colapsable inline.

### Reconciliación del Corte de Caja
```
BALANCED  → Badge verde  "✓ Cuadrado"
SURPLUS   → Badge azul   "↑ Sobrante: +$X"
SHORTAGE  → Badge rojo   "⚠ Faltante: -$X"  ← requiere atención del admin
```

---

## Flujos de Notificación Visual

Toda acción que dispara un webhook a n8n debe mostrar un **toast** (notificación no bloqueante) en la UI:

| Acción | Toast |
|---|---|
| Socio creado | `"✓ WhatsApp de bienvenida enviado a +52..."` |
| Premio desbloqueado | `"🏆 Premio notificado al socio"` |
| Corte de caja cerrado | `"✓ Resumen enviado al dueño por WhatsApp"` |

Los toasts usan el mismo glassmorphism de los paneles: `backdrop-blur-md bg-white/5 border border-white/10`.
