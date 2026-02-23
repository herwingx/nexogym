# Modelo de Datos (DATABASE_SCHEMA)

Este documento describe la estructura base que Prisma ORM desplegará en la base de datos PostgreSQL en Supabase.

## Diccionario de Tablas Críticas

### `Gyms` (Tenants Principales)
Contiene la información de los clientes B2B. Todo gira en torno a esta tabla.
- **Relaciones:** Tiene un `id` único.

### `Users`
Usuarios del sistema en todos sus roles (`SUPERADMIN`, `ADMIN`, `RECEPTIONIST`, `CLIENT`).
- Se ancla estrictamente a un `gym_id`. (Salvo el superadmin general, el resto no puede cruzar tenants).
- Contiene tokens, PIN y número telefónico para logeo y n8n WhatsApp.

### `Subscriptions`
Las membresías de clientes. Control de fechas de inicio, vencimiento y estados activo/inactivo.
- Filtro global automático por `gym_id`. Relacionada a un `user_id`.

### `Visits`
Registro histórico inmutable de visitas/entradas al gimnasio. Permite crear un historial para calcular rachas de asistencia recurrentes y reportes estadísticos de volumen a diferentes horas en el dashboard.
- Obligatoriamente filtrada por `gym_id`. Relacionada a `user_id`.

### `CashShifts`
Turnos o Cortes de Caja operativos de las recepciones del gimnasio. Los cobros de las subscripciones y el POS se ligan al turno abierto de caja.
- Filtro local `gym_id`.

### `Products`
Inventario para el Punto de Venta (POS) como agua, suplementos, camisas.
- Aislado vía `gym_id`.

---

## Tipos de Datos Especiales y Nativos (PostgreSQL)

Para dar más flexibilidad y menos migraciones en las configuraciones específicas, utilizaremos el potente `JSONB`. Recomendación para Prisma de establecer el tipo de campo base de Prisma como Json.

### Campos `JSONB`:
1. **`theme_colors` (en tabla Gyms):** Diccionario incrustado con la configuración de frontend de la marca de cada gimnasio, por ejemplo:
   ```json
   { "primary": "#ff007f", "accent": "#00f0ff" }
   ```
2. **`rewards_config` (en tabla Gyms o Config general):** Diccionario o Array de reglas de gamificación dictando a los cuantos días se ofrece un premio para ese gimnasio específico.
   ```json
   { "streak_5": "Agua de 1L", "streak_20": "Camisa GymSaaS" }
   ```

---

## Relaciones Clave
La clave foránea (Foreign Key) `gym_id` conecta *absolutamente todo* en cascada en la arquitectura de la base de datos.
Esta es la red de seguridad de nuestras políticas y es mandatoria de revisar en cada declaración de esquema y mutación (`create`, `update`, `delete`, `findMany`) de Prisma.
