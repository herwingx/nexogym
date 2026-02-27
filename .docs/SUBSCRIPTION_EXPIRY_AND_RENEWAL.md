# Suscripciones: vencimiento, congelación y renovación

Flujo real de estados y acciones para socios que se van y regresan. Incluye también el efecto del **plan del gym (SaaS)** en los socios cuando el gym no paga.

---

## 0. Plan del gym (SaaS) y efecto en los socios

El **gimnasio** tiene su propia suscripción con Nexo (plan/tier y estado). Si el gym **no paga**, puede quedar en **SUSPENDED** y eso afecta a **todos** sus socios.

- **Estado del gym:** `ACTIVE` | `SUSPENDED` | `CANCELLED`. Lo gestiona el SuperAdmin (ej. `PATCH /saas/gyms/:id/status`).
- **Si el gym está SUSPENDED:** Nadie (staff ni socios) puede usar el sistema para ese gym: el login/context devuelve 403 *"El acceso a este gimnasio está suspendido."* Los socios no pueden hacer check-in porque no pueden siquiera autenticarse en ese gym.
- **Al reactivar el gym (SUSPENDED → ACTIVE):** Se setea `gym.last_reactivated_at = ahora`. Durante **7 días** desde esa fecha, cualquier socio que vuelva a hacer check-in **mantiene la racha** (no se reinicia), pero ese día **no suma** +1; es lo justo porque físicamente no fueron esos días. Así, si el gym no pagó una semana y luego paga, los socios no pierden su progreso por algo que no fue culpa suya.
- **Plan/tier del gym (BASIC, PRO_QR, etc.):** Define qué módulos tiene (gamificación, POS, QR, etc.). Un cambio de plan (upgrade/downgrade) no suspende el acceso; solo habilita o quita funciones. En BASIC, gamificación está desactivada; solo Admin tiene acceso a ciertas funciones. La racha se congela por **vencimiento del socio** (7.1), **reactivación del gym** (7.2) o **días cerrados** (7.3); la ventana para socio es configurable (`streak_freeze_days`); para gym es **7 días** fijos.

---

## 1. Estados y cuándo se usan

| Estado   | Significado |
|----------|-------------|
| ACTIVE   | Puede entrar; `expires_at` en el futuro. |
| FROZEN   | Pausada; se guardaron los días restantes en `frozen_days_left`. |
| EXPIRED  | Fecha de vencimiento ya pasó (acceso bloqueado). |
| CANCELED | Baja voluntaria (no se renueva igual que EXPIRED). |
| PENDING_PAYMENT | Alta sin pago; **no puede entrar**. Se activa solo tras **Renovar** (requiere turno abierto si hay precio > 0). |

**Alta de socio:** Al crear un socio nuevo (`POST /users`), la suscripción se crea con estado **PENDING_PAYMENT**. El socio no puede hacer check-in hasta que recepción ejecute **Renovar** (con turno abierto). Así se evita "alta sin registro de pago en caja".

No hay congelación automática por fecha: cuando pasa `expires_at`, el **acceso** se niega en check-in, pero el estado en BD solo pasa a EXPIRED si se ejecuta el sync (ver más abajo).

---

## 2. Renovar (`PATCH /users/:id/renew`)

Regla: **si el socio se fue y regresa a pagar, el nuevo periodo empieza el día que paga (hoy).** Solo si sigue activo y con días restantes se extiende desde su fecha actual.

**PENDING_PAYMENT:** Al renovar un socio en estado PENDING_PAYMENT, la suscripción pasa a ACTIVE con `expires_at = hoy + días del plan`. Requiere turno abierto si el precio > 0 (registra el cobro en caja).

### 2.1 Precio y caja

- **Precio:** El monto se toma del producto con barcode **`MEMBERSHIP`** en Inventario (nombre típico: "Membresía 30 días"). **Admin** solo debe asignar el precio en Inventario; el producto ya viene dado de alta al crear el gym (junto con otros plantilla: visita 1 día, semanal, quincenal). Reception/Coach **no pueden ingresar monto manual** (evita manipulación).
- **Producto no existe:** En gyms creados desde el panel SaaS el producto ya existe. Si faltara (ej. gym migrado o borrado), el backend devuelve 400 indicando que debe existir un producto con código "MEMBERSHIP" y que en gyms nuevos ya viene de alta.
- **Registro en caja:** Si el producto tiene precio > 0 y hay turno abierto, se crea una `Sale` con ese precio y se suma al turno del usuario que renueva.

### 2.2 Lógica de extensión

- **ACTIVE y `expires_at` > hoy**  
  → Se extiende: nueva fecha = `expires_at` + 30 días.

- **EXPIRED, FROZEN o ACTIVE con `expires_at` ya vencida**  
  → Nuevo periodo desde el día que paga: nueva fecha = **hoy + 30 días**.  
  → Si estaba FROZEN se limpia `frozen_days_left`.

Resumen: “se va y regresa” = siempre desde hoy; “sigue activo y paga otro mes” = se suman 30 al vencimiento actual.

---

## 3. Congelar (`PATCH /users/:id/freeze`)

- Solo suscripciones **ACTIVE**.
- Se guarda en `frozen_days_left` los días que faltaban hasta `expires_at`.
- Estado pasa a **FROZEN**; `expires_at` no se modifica.

---

## 4. Descongelar (`PATCH /users/:id/unfreeze`)

- Solo suscripciones **FROZEN**.
- Nueva fecha de vencimiento: **hoy + `frozen_days_left`**.
- Estado → **ACTIVE**, `expires_at` actualizada, `frozen_days_left` = null.
- **Racha:** Al descongelar **no** se protege la racha. El socio eligió congelar; es justo que pierda la racha frente a quienes siguieron yendo. Solo se protege cuando no renovó a tiempo (7.1), gym no pagó (7.2) o días cerrados (7.3).

Cuando el socio vuelve a entrenar sin pagar de nuevo, se usa **Descongelar**. Cuando paga de nuevo, se usa **Renovar** (nuevo periodo desde hoy).

---

## 5. Cancelar (`PATCH /users/:id/cancel-subscription`)

- Solo suscripciones **ACTIVE** o **FROZEN**.
- **Motivo obligatorio:** `reason` (string).
- **Reembolso opcional:** `refund_amount` (number ≥ 0). Si > 0:
  - Requiere **turno de caja abierto** en el usuario que cancela (quien entrega el dinero al cliente).
  - Se registra un egreso tipo **REFUND** en el turno de quien cancela.
  - Puede ser otro turno distinto al que cobró la membresía: el egreso va al turno actual (quien hace la devolución). No genera faltante: el egreso reduce el saldo esperado y el efectivo sale del cajón actual. Ver **CORTES_CAJA_Y_STOCK.md** (sección 6.1).
- **Auditoría:** `SUBSCRIPTION_CANCELED` con `reason` y `refund_amount` (si aplica) en `details`.
- **Permisos:** Admin, SuperAdmin o staff con `can_view_members_admin` o `can_use_reception`.

---

## 6. Sincronizar vencidas (`POST /users/sync-expired-subscriptions`)

Para que en listados y reportes se vea “Expirado” cuando ya pasó la fecha:

- Endpoint (Admin): **POST** `/api/v1/users/sync-expired-subscriptions`.
- Marca como **EXPIRED** todas las suscripciones del gym con `status = ACTIVE` y `expires_at < hoy`.
- Además, por cada suscripción marcada EXPIRED, setea en el **usuario** `streak_freeze_until = expires_at + streak_freeze_days` (configurable por admin; ver sección 7).
- Respuesta: `{ count, message }`.
- Queda registrado en auditoría como `SUBSCRIPTIONS_SYNC_EXPIRED`.

Recomendación: llamar una vez al día (cron con JWT de admin o script que use este endpoint).

---

## 7. Congelar racha: tres casos (socio no renovó / gym no pagó / días cerrados)

Para que **no se pierda la racha** cuando hay un hueco de días sin check-in por causas ajenas al uso diario, hay tres mecanismos:

### 7.1 Socio no renovó a tiempo (suscripción del socio vencida)

- **Campo en User:** `streak_freeze_until` (DateTime, opcional). Si está seteo y el próximo check-in cae **antes o en** esa fecha, y han pasado más de 1 día desde el último check-in (`diffDays > 1`), la racha **se congela**: ni se reinicia ni se suma 1 (físicamente no fueron esos días; es lo justo).
- **Cuándo se setea:**
  1. **Sync de vencidas:** al marcar una suscripción como EXPIRED, se setea `user.streak_freeze_until = expires_at + streak_freeze_days`.
  2. **Check-in 403 (NO_ACTIVE_SUBSCRIPTION):** si intentan entrar sin suscripción activa, se setea `user.streak_freeze_until = hoy + streak_freeze_days` (por si el sync aún no corrió).
- **Días configurables:** `streak_freeze_days` está en `rewards_config` del gym. El admin lo configura en **Gamificación** (`/admin/rewards`). Default 7; rango 1–90.
- **Cuándo se limpia:** en el primer check-in exitoso donde se aplica el “streak freeze” (diffDays > 1 y `now <= streak_freeze_until`), tras actualizar la racha se pone `streak_freeze_until = null`.

Así, si el socio renueva uno o dos días después de vencer y vuelve a entrar, conserva su progreso de racha.

### 7.2 Gym no pagó (gimnasio suspendido y luego reactivado)

- **Campo en Gym:** `last_reactivated_at` (DateTime, opcional). Se setea cuando el SuperAdmin pasa el gym de **SUSPENDED** a **ACTIVE** (el gym “no pagó” y luego volvió a pagar).
- **Efecto:** Si han pasado más de 1 día desde el último check-in del socio (`diffDays > 1`) pero la fecha actual está **dentro de los 7 días** desde `last_reactivated_at`, la racha **se congela**: ni se reinicia ni se suma 1. En este caso el socio en teoría no pudo ir porque era el gym el que no pagó (acceso suspendido); es justo no penalizarlo y no regalarle +1.
- No se setea nada por socio; el perdón aplica a todos los socios del gym en ese periodo. **7 días fijos** (no configurable; el gym no pagó afecta a todos por igual).

---

### 7.3 Días que cierra el gym (opening_config)

- **Campo en Gym:** `opening_config` (Json): `{ closed_weekdays: [0, 6], closed_dates: ["01-01", "12-25"] }`.
  - `closed_weekdays`: 0=Dom, 1=Lun, ..., 6=Sab (días de la semana que no abre).
  - `closed_dates`: festivos anuales en formato MM-DD (ej. 01-01 Año Nuevo, 12-25 Navidad); máx. 30.
- **Configuración:** El admin configura en **Gamificación** (`/admin/rewards`), sección "Días que cierra el gym".
- **Efecto:** Si han pasado más de 1 día desde el último check-in (`diffDays > 1`) pero **todos** los días entre ese último check-in y hoy eran días cerrados (por weekday o por festivo), la racha **se congela**: ni se reinicia ni se suma 1. Ejemplo: gym abre lun–vie; socio entra lunes (último check-in viernes) → sáb y dom cerrados → freeze. Lo mismo si entre el último check-in y hoy cayeron solo festivos configurados (ej. 24–25 dic).
- **API:** `GET /api/v1/gym/opening-config`, `PATCH /api/v1/gym/opening-config` (body `{ closed_weekdays: number[], closed_dates?: string[] }`).

### 7.4 Cálculo por día calendario (asistencia pura)

- La racha se calcula por **día calendario** (24h). Si el socio no asiste un día (o varios) **sin** estar en vencimiento, congelación o gym suspendido, la racha **se reinicia** a 1 en el siguiente check-in. Solo se congela cuando aplica 7.1, 7.2 o 7.3.

### 7.5 Fechas: calendario real

- Todas las fechas se calculan con **calendario real**: meses con 28, 29, 30 o 31 días según el año (JavaScript `Date`). Por ejemplo: hoy 31 de enero + 30 días = 2 o 3 de marzo (según año bisiesto).
- La racha usa fechas absolutas (`last_checkin_date`, `streak_freeze_until`, etc.); no hay relación con la fecha de alta del gym. Las extensiones ("hoy + 30 días", "expires_at + 7 días") respetan el calendario real.

---

### Qué falta y por qué (revisión posterior)

| Qué falta | Dónde hacerlo | Por qué no está en el repo |
|-----------|----------------|----------------------------|
| **Ejecutar sync de vencidas una vez al día** | Cron job o scheduler (hosting, GitHub Actions, Cloudflare Workers, etc.) | El endpoint `POST /users/sync-expired-subscriptions` ya existe; lo que falta es **quién** lo llama y cuándo. Eso se configura en la infra (cron, workflow programado), no dentro del código de la API. Si no configuras nada, los listados pueden seguir mostrando “ACTIVE” aunque `expires_at` ya pasó hasta que alguien llame al endpoint manualmente o hasta el próximo login que sincronice. |

---

## 8. Flujo resumido

| Situación | Acción | Resultado |
|-----------|--------|-----------|
| Venció la fecha, vuelve a pagar | **Renovar** | ACTIVE, vence **hoy + 30**. |
| Estaba congelado, vuelve a pagar | **Renovar** | ACTIVE, vence **hoy + 30**; se limpia congelado. |
| Estaba congelado, vuelve a entrenar sin pagar | **Descongelar** | ACTIVE, vence **hoy + días guardados**. |
| Sigue activo, paga otro mes | **Renovar** | ACTIVE, vence **expires_at actual + 30**. |
| Baja voluntaria (activo o congelado) | **Cancelar** | CANCELED; opcional reembolso (egreso REFUND, requiere turno). |
| Listados/BD con fechas vencidas | **Sync vencidas** | ACTIVE con `expires_at` pasada → EXPIRED. |
