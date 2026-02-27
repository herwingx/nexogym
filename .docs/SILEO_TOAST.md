# Sileo — Toast Component for React

Sileo is a lightweight, opinionated toast notification library for React. It uses SVG morphing and spring physics to create smooth, visually appealing notifications — **beautiful by default, no configuration needed**.

Referencia oficial: https://sileo.aaryan.design/docs/api

---

## Instalación

```bash
npm install sileo
```

---

## Configuración inicial

1. Añadir el componente `Toaster` en el layout raíz de la app:

```jsx
import { Toaster } from 'sileo';

function App() {
  return (
    <>
      <YourApp />
      <Toaster />
    </>
  );
}
```

2. Importar y usar el controlador global desde cualquier parte:

```jsx
import { sileo } from 'sileo';

sileo('Hello, world!');
```

---

## Métodos disponibles

El objeto `sileo` expone los siguientes métodos:

| Método | Descripción |
|--------|-------------|
| `sileo.success(options)` | Toast verde de éxito |
| `sileo.error(options)` | Toast rojo de error |
| `sileo.warning(options)` | Toast ámbar de advertencia |
| `sileo.info(options)` | Toast azul informativo |
| `sileo.action(options)` | Toast con botón de acción |
| `sileo.show(options)` | Toast genérico (por defecto estado success) |
| `sileo.promise(promise, opts)` | Flujo loading → success/error |
| `sileo.dismiss(id)` | Descarta un toast específico por id |
| `sileo.clear(position?)` | Limpia todos los toasts, o solo los de una posición |

---

## Ejemplos de uso

### Toast de acción

```jsx
sileo.action({
  title: 'Are you sure?',
  button: {
    title: 'Yes',
    onClick: () => console.log('Confirmed'),
  },
});
```

### Toast de promesa

Encadena estados loading → success/error a partir de una promesa:

```jsx
sileo.promise(createUser(data), {
  loading: { title: 'Creating account...' },
  success: (user) => ({ title: `Welcome, ${user.name}!` }),
  error: (err) => ({
    title: 'Signup failed',
    description: err.message,
  }),
});
```

---

## Posiciones

Sileo soporta 6 posiciones. Se puede configurar globalmente en `Toaster` o sobreescribir por toast individual:

```jsx
// Global
<Toaster position="top-right" />
```

```jsx
// Por toast
sileo({
  message: 'Top left toast',
  position: 'top-left',
});
```

**Posiciones disponibles:**

| Valor           | Descripción           |
|-----------------|-----------------------|
| `top-left`      | Arriba a la izquierda |
| `top-center`    | Arriba al centro      |
| `top-right`     | Arriba a la derecha   |
| `bottom-left`   | Abajo a la izquierda  |
| `bottom-center` | Abajo al centro       |
| `bottom-right`  | Abajo a la derecha    |

---

## Opciones (`SileoOptions`)

Todos los métodos aceptan un objeto `SileoOptions`:

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `title` | `string` | — | Título del toast |
| `description` | `ReactNode \| string` | — | Cuerpo del mensaje, soporta JSX |
| `position` | `SileoPosition` | Default del Toaster | Sobreescribe la posición para este toast |
| `duration` | `number \| null` | `6000` | Ms antes de auto-dismiss. `null` = sticky |
| `icon` | `ReactNode \| null` | Ícono del estado | Ícono personalizado en el badge |
| `fill` | `string` | `"#FFFFFF"` | Color de fondo del SVG del toast |
| `styles` | `SileoStyles` | — | Clases CSS para sub-elementos |
| `roundness` | `number` | `16` | Radio del borde en píxeles |
| `autopilot` | `boolean \| object` | `true` | Timing de expand/collapse automático |
| `button` | `SileoButton` | — | Configuración del botón de acción |

---

## Personalización de estilos

Referencia: https://sileo.aaryan.design/docs/styling

### Toast oscuro con `fill`

El prop `fill` define el color de fondo SVG. Para un toast oscuro, combinarlo con clases de texto claras:

```jsx
sileo.success({
  title: 'Dark toast',
  fill: '#171717',
  styles: {
    title: 'text-white!',
    description: 'text-white/75!',
  },
});
```

### Sobreescribir clases con `styles`

```jsx
sileo.success({
  title: 'Custom styled',
  fill: 'black',
  styles: {
    title: 'text-white!',
    description: 'text-white/75!',
    badge: 'bg-white/20!',
    button: 'bg-white/10!',
  },
});
```

---

## Override z-index para modales

Si los modales usan `backdrop-blur` o alto z-index, los toasts de Sileo pueden quedar detrás. Solución: añadir `toast-override.css` con:

```css
[data-sileo-viewport] {
  z-index: 9999 !important;
}
```

Importar este CSS después de los estilos de Sileo.

---

## Notas

- No requiere configuración de estilos — Sileo lo maneja internamente.
- Las animaciones están basadas en física de resortes (spring physics) y morfado SVG.
- Compatible con cualquier setup de React (Vite, Next.js, CRA, etc.).
