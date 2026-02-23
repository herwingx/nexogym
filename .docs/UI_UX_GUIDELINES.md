# Reglas de Interfaz (UI_UX_GUIDELINES)

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
