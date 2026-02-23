# Contratos de la API (API_SPEC)

## Convención de Rutas Base
Todas las rutas de la API deben ser versionadas y estructuradas bajo:
`/api/v1/[recurso]`

### Autenticación Global (Middleware)
Todas las rutas protegidas requieren un Bearer token. El middleware de Express se encarga de interceptarlo, decodificar el JWT de Supabase, y extraer el `userId`, `role`, y la clave de tenant `gymId`. Ésta información se adjunta a `req.user`.

---

## Endpoints Principales (Core)

### 1. Control de Acceso (CheckIn)
- **Método y Ruta:** `POST /api/v1/checkin`
- **Descripción:** Registra la visita de un cliente usando el escáner (o ID manual).
- **Cuerpo Esperado (Input):**
  ```json
  { "userId": "uuid-del-cliente" }
  ```
  *(El gym_id lo pone implícitamente el middleware si la caja está abierta, o se requiere explícitamente si el scanner es en la API global).*
- **Respuesta (Output):**
  ```json
  { 
    "success": true, 
    "newStreak": 5, 
    "rewardUnlocked": false,
    "message": "¡De vuelta al ruedo!"
  }
  ```

### 2. Gestión de Usuarios
- **Método y Ruta:** `POST /api/v1/users`
- **Descripción:** Creación de nuevos usuarios del gimnasio (para clientes, por parte del recepcionista).
- **Cuerpo Esperado:**
  ```json
  {
    "name": "Juan Pérez",
    "role": "CLIENT",
    "phone": "+52...1234",
    "pin": "1234"
  }
  ```
- **Respuesta:**
  ```json
  { "id": "uuid", "message": "Usuario creado satisfactoriamente." }
  ```

---

## Integración con Webhooks (n8n)
La arquitectura demanda una descongestión del loop de eventos del backend para tareas pesadas como integraciones con hardware externo o APIs de mensajería comercial. El Backend hace llamadas asíncronas no bloqueantes a webhooks predefinidos de la instancia local de n8n.

### Webhook 1: Bienvenida de Usuario Nuevo
Al finalizar correctamente `POST /api/v1/users` de un rol `CLIENT`:
- **Disparador del Backend:** Petición HTTP POST local a `http://n8n-local:5678/webhook/nuevo-cliente`
- **Payload:** `{ "phone": "+52...", "pin": "1234", "qrData": "...link al qr portal..." }`
- **Flujo en n8n:** Envía a WhatsApp de forma encolada de inmediato.

### Webhook 2: Premio Gamificación
Si el `checkin` regresa `rewardUnlocked: true`:
- **Disparador del Backend:** Petición HTTP POST a `http://n8n-local:5678/webhook/recompensa`
- **Payload:** `{ "phone": "...", "rewardName": "Botella de Agua Gratis", "streak": 5 }`
