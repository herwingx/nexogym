# Product Requirements Document (PRD)

## Nuevos Módulos de Gestión Profesional

### Módulo 9: Reservas de Clases (Booking)
- Creación de horarios de clases por día de la semana.
- Control de cupo automático (evita sobrecupo).
- Los socios reservan desde el portal PWA.

### Módulo 10: Seguimiento de Entrenamiento (Routines)
- El staff asigna rutinas digitales para eliminar el papel en el gym.
- Registro de ejercicios, series, repeticiones y pesos.

### Módulo 11: Control de Staff y Comisiones
- Asignación de vendedores a cada transacción.
- Rol `INSTRUCTOR` para gestionar rutinas y clases.

### Módulo 12: Planes con Restricción Horaria
- Capacidad de vender planes económicos (ej: "Solo Mañanas").
- Validación automática en el torniquete/recepción según la hora de entrada.

### Módulo 13: Control de Reingreso y Validación Visual
- Anti-Passback en check-in para bloquear reutilización del pase antes de 4 horas.
- Validación visual en recepción mostrando nombre y foto del socio en la respuesta del escáner.

### Módulo 14: Feature Flags SaaS por Plan
- Cada gimnasio almacena `modules_config` para activar/desactivar módulos.
- Configuración por defecto al crear gimnasio y actualización automática al cambiar tier.
- Métrica global de gimnasios activos para panel SuperAdmin.
