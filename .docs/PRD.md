# Product Requirements Document (PRD)

Actualizado tras la implementación del ERP Full (Sprints B1–B9).

---

## Visión del Producto
SaaS B2B multitenant para gimnasios locales. ERP completo con bajo costo de hardware y alta retención de clientes. Abarca control de accesos, inventario real, flujo de caja (ingresos y egresos), auditoría anti-robos y gamificación.

---

## Módulos del Sistema

### Módulo 1: Control de Accesos (Sprint B4)
- Acceso por PIN manual, QR o huella dactilar (biométrico ZKTeco)
- Validación en tiempo real de membresía activa
- **Acceso de cortesía** autorizado solo por ADMIN — queda registrado en auditoría
- Integración con torniquete físico vía API IoT (Sprint B9)

### Módulo 2: Gestión de Socios / CRM (Sprint B3)
- Alta de socios con PIN auto-generado y WhatsApp de bienvenida automático
- Ciclo de vida completo: crear → renovar → congelar → descongelar → soft-delete
- Congelamiento de membresía con preservación exacta de días restantes

### Módulo 3: Gamificación (Sprint B4)
- Cálculo de racha de asistencia (`current_streak`) en cada check-in
- Configuración flexible por gimnasio (`rewards_config` JSONB)
  ```json
  { "5": "Agua 1L gratis", "20": "Camisa del gym", "30": "Mes gratis" }
  ```
- Notificación automática por WhatsApp cuando se desbloquea un premio

### Módulo 4: Inventario Anti-Robo (Sprint B5)
- Control de stock con historial de movimientos inmutable (`InventoryTransaction`)
- **Restock:** suma unidades + registro de entrada
- **Merma (Loss):** justificación **obligatoria** + registro en `AuditLog`
- El dueño puede auditar quién reportó cada "rotura" o "caducidad"

### Módulo 5: Punto de Venta POS (Sprint B6)
- Venta de productos con descuento automático de stock
- Precio histórico guardado en `SaleItem` (no cambia si sube el precio)
- Ventas vinculadas al turno de caja activo
- Registro de egresos con descripción obligatoria

### Módulo 6: Cortes de Caja (Sprint B7)
- Turno con fondo inicial declarado por el recepcionista
- Cálculo automático: `Fondo + Ventas - Egresos = Saldo Esperado`
- Comparación con el monto físico declarado al cierre
- Estado del corte: `BALANCED / SURPLUS / SHORTAGE`
- Envío automático del resumen al dueño por WhatsApp

### Módulo 7: Reportes y Auditoría (Sprint B8)
- **Semáforo de ocupación** en tiempo real (últimos 90 minutos)
- **Reporte financiero mensual** con ganancia neta
- **Bitácora de auditoría** consultable con filtros por tipo de acción y usuario

### Módulo 8: Panel SuperAdmin (Sprint B3)
- Creación de gimnasios (tenants) con API Key de hardware única
- Gestión de planes de suscripción del SaaS (`BASIC / PRO_QR / PREMIUM_BIO`)

---

## Estructura de Permisos (RBAC)

| Rol | Descripción | Acciones Exclusivas |
|---|---|---|
| `SUPERADMIN` | Dueño del SaaS | Crear/configurar gimnasios, gestionar planes |
| `ADMIN` | Dueño del gimnasio | Ver auditoría, reportes financieros, autorizar cortesías |
| `RECEPTIONIST` | Operación diaria | Check-in, POS, turnos de caja, registrar socios |
| `MEMBER` | Socio del gimnasio | Ver su membresía, racha y QR en el portal |

---

## Casos de Uso Principales (User Journeys)

1. **Apertura de turno:** El recepcionista declara el fondo inicial → sistema crea `CashShift OPEN`.
2. **Registro de socio:** Recepcionista ingresa datos → sistema crea usuario + membresía en transacción → WhatsApp con PIN y QR.
3. **Acceso con QR:** Cliente escanea QR → sistema valida membresía → suma racha → notifica si hay premio.
4. **Acceso de cortesía:** Socio sin membresía activa → Admin autoriza entrada → queda en AuditLog.
5. **Venta en POS:** Recepcionista vende agua → sistema descuenta stock + registra venta en el turno.
6. **Egreso de caja:** Recepcionista paga garrafones → sistema lo descuenta del balance esperado.
7. **Cierre de turno:** Recepcionista declara efectivo → sistema calcula diferencia → WhatsApp al dueño.
8. **Auditoría:** Dueño revisa si el recepcionista regaló cortesías o reportó mermas falsas.

---

## Planes del SaaS

| Plan | Acceso | IoT | Analytics |
|---|---|---|---|
| `BASIC` | Manual + PIN | ❌ | Básico |
| `PRO_QR` | Manual + QR | ❌ | Completo |
| `PREMIUM_BIO` | Manual + QR + Biométrico | ✅ ZKTeco | Completo |
