# Suscripciones: vencimiento, congelación y renovación

Flujo real de estados y acciones para socios que se van y regresan.

---

## 1. Estados y cuándo se usan

| Estado   | Significado |
|----------|-------------|
| ACTIVE   | Puede entrar; `expires_at` en el futuro. |
| FROZEN   | Pausada; se guardaron los días restantes en `frozen_days_left`. |
| EXPIRED  | Fecha de vencimiento ya pasó (acceso bloqueado). |
| CANCELED | Baja voluntaria (no se renueva igual que EXPIRED). |

No hay congelación automática por fecha: cuando pasa `expires_at`, el **acceso** se niega en check-in, pero el estado en BD solo pasa a EXPIRED si se ejecuta el sync (ver más abajo).

---

## 2. Renovar (`PATCH /users/:id/renew`)

Regla: **si el socio se fue y regresa a pagar, el nuevo periodo empieza el día que paga (hoy).** Solo si sigue activo y con días restantes se extiende desde su fecha actual.

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

Cuando el socio vuelve a entrenar sin pagar de nuevo, se usa **Descongelar**. Cuando paga de nuevo, se usa **Renovar** (nuevo periodo desde hoy).

---

## 5. Sincronizar vencidas (`POST /users/sync-expired-subscriptions`)

Para que en listados y reportes se vea “Expirado” cuando ya pasó la fecha:

- Endpoint (Admin): **POST** `/api/v1/users/sync-expired-subscriptions`.
- Marca como **EXPIRED** todas las suscripciones del gym con `status = ACTIVE` y `expires_at < hoy`.
- Además, por cada suscripción marcada EXPIRED, setea en el **usuario** `streak_freeze_until = expires_at + 7 días` (ver sección 7).
- Respuesta: `{ count, message }`.
- Queda registrado en auditoría como `SUBSCRIPTIONS_SYNC_EXPIRED`.

Recomendación: llamar una vez al día (cron con JWT de admin o script que use este endpoint).

---

## 7. Congelar racha al vencer suscripción (streak freeze por vencimiento)

Para que un socio que se pasó 1–2 días (o hasta 7) sin renovar **no pierda la racha** al volver a entrar después de pagar:

- **Campo en User:** `streak_freeze_until` (DateTime, opcional). Si está seteo y el próximo check-in cae **antes o en** esa fecha, y han pasado más de 1 día desde el último check-in (`diffDays > 1`), la racha **no se reinicia**: se mantiene y se suma 1 (como si hubiera sido día consecutivo).
- **Cuándo se setea:**
  1. **Sync de vencidas:** al marcar una suscripción como EXPIRED, se setea `user.streak_freeze_until = expires_at + 7 días`.
  2. **Check-in 403 (NO_ACTIVE_SUBSCRIPTION):** si intentan entrar sin suscripción activa, se setea `user.streak_freeze_until = hoy + 7 días` (por si el sync aún no corrió).
- **Cuándo se limpia:** en el primer check-in exitoso donde se aplica el “streak freeze” por vencimiento (diffDays > 1 y `now <= streak_freeze_until`), tras actualizar la racha se pone `streak_freeze_until = null`.

Así, si el socio renueva uno o dos días después de vencer y vuelve a entrar, conserva su progreso de racha. El período de gracia es de **7 días** (mismo valor en sync y en check-in 403).

---

### Qué falta y por qué (revisión posterior)

| Qué falta | Dónde hacerlo | Por qué no está en el repo |
|-----------|----------------|----------------------------|
| **Ejecutar sync de vencidas una vez al día** | Cron job o scheduler (hosting, GitHub Actions, Cloudflare Workers, etc.) | El endpoint `POST /users/sync-expired-subscriptions` ya existe; lo que falta es **quién** lo llama y cuándo. Eso se configura en la infra (cron, workflow programado), no dentro del código de la API. Si no configuras nada, los listados pueden seguir mostrando “ACTIVE” aunque `expires_at` ya pasó hasta que alguien llame al endpoint manualmente o hasta el próximo login que sincronice. |

---

## 6. Flujo resumido

| Situación | Acción | Resultado |
|-----------|--------|-----------|
| Venció la fecha, vuelve a pagar | **Renovar** | ACTIVE, vence **hoy + 30**. |
| Estaba congelado, vuelve a pagar | **Renovar** | ACTIVE, vence **hoy + 30**; se limpia congelado. |
| Estaba congelado, vuelve a entrenar sin pagar | **Descongelar** | ACTIVE, vence **hoy + días guardados**. |
| Sigue activo, paga otro mes | **Renovar** | ACTIVE, vence **expires_at actual + 30**. |
| Listados/BD con fechas vencidas | **Sync vencidas** | ACTIVE con `expires_at` pasada → EXPIRED. |
