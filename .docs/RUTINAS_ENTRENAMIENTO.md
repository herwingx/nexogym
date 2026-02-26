# Rutinas de entrenamiento

Documentación del módulo de rutinas personalizadas: asignación, catálogo de ejercicios, edición y flujo completo.

> **Módulo:** `classes` (requiere plan PRO_QR o PREMIUM_BIO).  
> **Ruta:** Admin `/admin/routines`.

---

## 1. Modelos

### Routine

| Campo       | Tipo    | Descripción                                                          |
|-------------|---------|----------------------------------------------------------------------|
| `id`        | UUID    | PK                                                                   |
| `gym_id`    | UUID    | Multitenancy                                                         |
| `user_id`   | UUID?   | `null` = plantilla base (sin socio); `set` = rutina asignada a socio |
| `name`      | String  | Nombre de la rutina                                                  |
| `description` | String? | Descripción opcional                                               |

### WorkoutExercise

| Campo       | Tipo    | Descripción                    |
|-------------|---------|--------------------------------|
| `id`        | UUID    | PK                             |
| `routine_id`| UUID    | FK a Routine                   |
| `name`      | String  | Nombre del ejercicio           |
| `sets`      | Int     | Series                         |
| `reps`      | Int     | Repeticiones                   |
| `weight`    | Decimal?| Peso (kg) opcional              |
| `notes`     | String? | Notas                          |

### Exercise (catálogo)

| Campo     | Tipo   | Descripción                        |
|-----------|--------|------------------------------------|
| `id`      | UUID   | PK                                 |
| `gym_id`  | UUID   | Multitenancy                       |
| `name`    | String | Nombre del ejercicio               |
| `category`| String?| Ej: "Pecho", "Piernas", "Espalda"  |

---

## 2. Flujo Admin

### Plantillas base vs rutinas asignadas

- **Plantilla base:** rutina sin socio (`user_id = null`). Catálogo reutilizable del gym. No aparece en el portal del socio.
- **Rutina asignada:** rutina vinculada a un socio. Visible en `GET /routines/me` para ese socio.

### Crear rutina

1. **Nueva rutina** → campo **Socio** opcional.
   - Vacío: crea **plantilla base** (para asignar después a socios).
   - Con socio seleccionado: crea rutina directamente asignada.
2. Opcionalmente: **Usar rutina existente como base** — copia nombre, descripción y ejercicios.
3. Nombre de rutina y descripción opcional.
4. Ejercicios: autocompletado desde catálogo o nombre libre. Series, reps, peso opcional.
5. **API:** `POST /api/v1/routines` con `{ userId?, name, description?, exercises[] }` — `userId` opcional.

### Asignar rutina a más socios (duplicar)

- Desde cualquier rutina (plantilla o asignada): botón **Asignar a más socios**.
- Busca socios por nombre/teléfono, añade a la lista y confirma.
- Se crean copias de la rutina (nombre, descripción, ejercicios) para cada socio seleccionado. La plantilla original no se modifica.
- **API:** `POST /api/v1/routines/:id/duplicate` con `{ userIds: string[] }`.

### Editar rutina

- Expandir rutina → **Editar**.
- Cambiar nombre, descripción.
- Quitar ejercicios (botón eliminar).
- Añadir ejercicios (botón Añadir).
- Modificar series/reps/peso de ejercicios existentes.
- **API:** `PATCH /routines/:id`, `POST/DELETE/PATCH /routines/:id/exercises/*`.

### Eliminar rutina

- Botón **Eliminar** con confirmación. Se eliminan los ejercicios asociados (cascade).

---

## 3. Catálogo de ejercicios

- **Base de ejercicios:** modelo `Exercise` por gym. Al crear un gym (panel SaaS), se crea automáticamente la base de ~30 ejercicios (Pecho, Espalda, Hombros, Brazos, Piernas, Core).
- **API:** `GET /api/v1/exercises?q=&category=` para autocompletado.
- **Origen:** `backend/src/data/default-exercises.ts` — misma lista usada en seed y al dar de alta un gym.
- Admin y coaches (con permiso de rutinas) pueden añadir más ejercicios con `POST /api/v1/exercises`.

---

## 4. Socio (portal)

- **GET /api/v1/routines/me:** el socio consulta sus rutinas asignadas con ejercicios.
- Visible en el portal del socio si el módulo está habilitado.
