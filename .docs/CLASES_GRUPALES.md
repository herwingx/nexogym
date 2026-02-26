# Clases grupales y reservas

Documentación del módulo de clases grupales: gestión, reservas, asistencia y costos opcionales.

> **Módulo:** `classes` (requiere plan PRO_QR o PREMIUM_BIO).  
> **Rutas principales:** Admin `/admin/classes`, Socio `/member/classes`.

---

## 1. Modelo de datos

### GymClass

| Campo         | Tipo   | Descripción                                       |
|---------------|--------|---------------------------------------------------|
| `id`          | UUID   | PK                                                |
| `gym_id`      | UUID   | Multitenancy                                      |
| `instructor_id` | UUID | FK a User (rol COACH o INSTRUCTOR)               |
| `name`        | String | Nombre de la clase                                |
| `description` | String?| Descripción opcional                              |
| `capacity`    | Int    | Cupo máximo de personas                           |
| `day_of_week` | Int    | 0–6 (0=Domingo, 6=Sábado)                         |
| `start_time`  | String | HH:mm                                             |
| `end_time`    | String | HH:mm                                             |
| `price`       | Decimal?| Costo opcional (clases externas o especiales)    |

Las clases son **recurrentes por día de la semana**. Una clase el lunes a las 08:00 se repite todos los lunes.

### ClassBooking

| Campo         | Tipo   | Descripción                          |
|---------------|--------|--------------------------------------|
| `id`          | UUID   | PK                                   |
| `gym_id`      | UUID   |                                      |
| `class_id`    | UUID   | Clase reservada                      |
| `user_id`     | UUID   | Socio que reserva                    |
| `booking_date`| Date   | Fecha concreta (YYYY-MM-DD)          |
| `status`      | Enum   | PENDING / ATTENDED / CANCELLED       |

---

## 2. Flujo Admin

### Crear clase

1. **Nueva clase** → formulario con:
   - Nombre
   - Instructor (selector de COACH/INSTRUCTOR; usa `GET /users/instructors`, requiere solo `can_use_routines`)
   - Descripción (opcional)
   - Día de la semana
   - Hora inicio / Hora fin
   - Cupo
   - Costo (opcional, para clases externas o especiales)

2. **API:** `POST /api/v1/bookings/classes`  
   - Body: `{ name, description?, instructorId, capacity, day_of_week, start_time, end_time, price? }`

### Editar clase

- En cada tarjeta de clase: botón **Editar** → mismo formulario con datos precargados.
- **API:** `PATCH /api/v1/bookings/classes/:id`

### Eliminar clase

- Botón **Eliminar** con confirmación. Se eliminan también las reservas asociadas (cascade).
- **API:** `DELETE /api/v1/bookings/classes/:id`

### Reservar (Admin/Staff)

- El Admin puede reservar para sí mismo (si tiene membresía activa) en el panel.
- **API:** `POST /api/v1/bookings` con `{ classId, date }`

---

## 3. Flujo Socio (portal)

### Ver clases

- Ruta: `/member/classes`
- Selector de **día** (Dom–Sáb) y **fecha** (navegación día anterior/siguiente).
- Se muestran: nombre, horario, instructor, cupos disponibles, costo (si aplica).

### Reservar

- Botón **Reservar** en cada clase con cupo disponible.
- Requiere **membresía activa**.
- **API:** `POST /api/v1/bookings` con `{ classId, date }`

### Mis reservas

- Lista de reservas futuras.
- Botón **Cancelar** para cancelar una reserva.
- **API:** `GET /api/v1/bookings/me`, `DELETE /api/v1/bookings/:id`

### Costos (clases externas)

- Si la clase tiene `price > 0`, se muestra el monto.
- Los socios pueden revisar el costo antes de reservar.
- El pago real (POS, transferencia, etc.) se gestiona fuera del sistema de reservas; aquí solo se informa el precio.

---

## 4. Cupos disponibles (`available_slots`)

El backend calcula los cupos disponibles por clase y fecha:

- `GET /api/v1/bookings/classes?day=1&date=2026-02-26`
- Para cada clase del día, se cuenta cuántas reservas existen para esa fecha (excluyendo canceladas).
- `available_slots = capacity - count(bookings activos para esa fecha)`.

Si no se envía `date`, se devuelve `available_slots = capacity` (sin descontar reservas).

---

## 5. Asistencia (Admin/Instructor)

- **API:** `PATCH /api/v1/bookings/:id/attend`
- Marca una reserva como asistida (`status: ATTENDED`).
- Requiere rol Coach o Admin (`requireCanUseRoutines`).

---

## 6. API resumida

| Método | Endpoint                        | Rol        | Descripción              |
|--------|---------------------------------|------------|--------------------------|
| GET    | `/bookings/classes?day=&date=`  | Auth       | Listar clases con cupos  |
| POST   | `/bookings/classes`             | Admin      | Crear clase              |
| PATCH  | `/bookings/classes/:id`         | Admin      | Editar clase             |
| DELETE | `/bookings/classes/:id`         | Admin      | Eliminar clase           |
| POST   | `/bookings`                     | Auth       | Crear reserva            |
| GET    | `/bookings/me`                  | Auth       | Mis reservas             |
| DELETE | `/bookings/:id`                 | Auth       | Cancelar reserva propia  |
| PATCH  | `/bookings/:id/attend`          | Coach/Admin| Marcar asistencia        |

---

## 7. Navegación

- **Admin:** sidebar → Clases (`/admin/classes`), visible si módulo `classes` está activo.
- **Socio:** barra inferior → Clases (`/member/classes`), visible si módulo `classes` está activo.
