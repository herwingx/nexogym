# Skeletons de Carga — Reglas y Uso

Documento de referencia para el uso de **skeletons** (placeholders animados) durante la carga de datos en el frontend de NexoGym. El objetivo es mejorar la percepción de velocidad y dar una experiencia visual coherente en todas las vistas.

> **Regla:** Toda vista que cargue datos asincrónicos (API) debe mostrar un skeleton que refleje la estructura del contenido final, en lugar de un spinner genérico o un "—" en blanco.

---

## 1. Cuándo usar skeletons

- **Sí:** Listas (tablas, grids de cards), dashboards con métricas, perfiles (portal del socio), cualquier bloque que tarde > ~200 ms en cargar.
- **No:** Acciones puntuales (submit de formulario → usar `isLoading` en el botón). Pantallas que cargan al instante (datos en memoria).

---

## 2. Estilo visual (alineado a UI_UX_GUIDELINES.md)

- **Base:** `bg-zinc-200 dark:bg-zinc-800` con `animate-pulse`.
- **Bordes:** Misma card que el contenido final: `rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900`.
- **Altura:** El skeleton debe aproximar la altura del contenido real (evitar saltos de layout al reemplazar por datos).
- **Sin texto real:** Solo bloques de color animados; no poner "Cargando..." dentro del skeleton (el toast/spinner global puede usarse para acciones críticas si hace falta).

---

## 3. Componentes disponibles

Ubicación: `frontend/src/components/ui/Skeleton.tsx`.

| Componente        | Uso |
|-------------------|-----|
| `Skeleton`        | Bloque genérico (className para ancho/alto). |
| `CardSkeleton`   | Card con título + 2–3 líneas de contenido (métricas, dashboards). |
| `TableRowSkeleton`| Fila de tabla con N celdas (listas, auditoría). |
| `ListSkeleton`   | Lista de items (clases, rutinas, historial). |

Ver implementación en código para props (ej. `lines`, `columns`).

---

## 4. Vistas que deben usar skeletons

Cada fila indica la vista y el tipo de skeleton recomendado.

| Vista | Skeleton recomendado |
|-------|----------------------|
| **Admin** | |
| `/admin` (Dashboard) | 2× o 3× `CardSkeleton`: ventas y ganancia siempre; ocupación solo si el gym tiene Check-in QR. |
| `/admin/finance` | `CardSkeleton` para resumen + opcional tabla |
| `/admin/members` | `TableRowSkeleton` × N o `ListSkeleton` |
| `/admin/classes` | `ListSkeleton` o grid de cards |
| `/admin/routines` | `ListSkeleton` |
| `/admin/audit` | `TableRowSkeleton` × N |
| `/admin/inventory` | `TableRowSkeleton` o grid |
| **Recepción** | |
| `/reception/checkin` | Solo botón/input loading si aplica |
| `/reception/pos` | Grid de productos: skeletons de cards |
| **Portal del socio** | |
| `/member` (MemberHome) | 1× `CardSkeleton` para bloque QR + estado |
| `/member/rewards` | Card racha + participación por premios del gym + próximo premio + hitos |
| `/member/history` | `ListSkeleton` o `TableRowSkeleton` |
| **SuperAdmin** | |
| `/super` (Dashboard) | Cards de métricas + lista de gimnasios |

Al añadir una nueva pantalla que cargue datos, revisar este documento y reutilizar el componente que mejor coincida con el layout.

---

## 5. Patrón de uso en código

```tsx
// 1. Estado de carga
const [isLoading, setIsLoading] = useState(true)

// 2. Al montar o al cambiar filtros
useEffect(() => {
  const load = async () => {
    setIsLoading(true)
    try {
      const data = await fetchSomething()
      setData(data)
    } finally {
      setIsLoading(false)
    }
  }
  load()
}, [deps])

// 3. En el JSX: skeleton mientras carga, contenido cuando ya hay datos
return (
  <section>
    {isLoading ? (
      <CardSkeleton count={3} />
    ) : (
      <RealContent data={data} />
    )}
  </section>
)
```

- No mezclar spinner central con skeletons en la misma vista: elegir uno (preferir skeleton para listas/dashboards).
- El empty state (sin datos) se muestra cuando `!isLoading && data.length === 0`, no con skeleton.

---

## 6. Resumen

- **Skeleton** = placeholder que imita la forma del contenido y usa `animate-pulse`.
- **Regla:** Vistas con carga asincrónica muestran skeleton por defecto.
- **Componentes:** `Skeleton`, `CardSkeleton`, `TableRowSkeleton`, `ListSkeleton` en `components/ui/Skeleton.tsx`.
- **Doc de estética general:** `UI_UX_GUIDELINES.md`.
