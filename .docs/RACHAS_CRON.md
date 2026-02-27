# Cron de reset de rachas

Documentación del job diario que resetea las rachas de socios que no hicieron check-in el día anterior.

---

## Resumen

La racha se actualiza de dos formas:

1. **En check-in:** Cuando el socio hace check-in, el backend calcula si la racha incrementa, se congela o se reinicia a 1 (ver `SUBSCRIPTION_EXPIRY_AND_RENEWAL.md` sección 7).
2. **Cron diario:** Un job que corre después de medianoche (ej. 00:05 UTC) resetea `current_streak = 0` para socios cuyo `last_checkin_date` es anterior a "ayer".

Si no existiera el cron, un socio que no va 3 días seguiría viendo su racha antigua hasta que haga el siguiente check-in. El cron evita esa inconsistencia: tras medianoche del día siguiente al último check-in, la racha pasa a 0.

---

## Endpoint

```
POST /api/v1/webhooks/streak-reset
```

**Seguridad:** Si está definido `CRON_WEBHOOK_SECRET` en el entorno, el request debe incluir:

```
x-cron-secret: <CRON_WEBHOOK_SECRET>
```

Si no se define el secreto, el endpoint acepta cualquier request (solo para desarrollo).

---

## Cuándo ejecutarlo

**Recomendado:** Diario a las **00:05 UTC** (o 00:10) — justo después de medianoche para que "ayer" ya esté cerrado.

**Ejemplo con cron (Linux):**
```bash
# .env
CRON_WEBHOOK_SECRET=un-secreto-aleatorio-largo

# crontab
5 0 * * * curl -X POST -H "x-cron-secret: $CRON_WEBHOOK_SECRET" https://api.nexogym.com/api/v1/webhooks/streak-reset
```

---

## Lógica por gym (multitenant)

Para cada gym con gamificación habilitada:

1. **"Ayer"** = hoy - 1 día (por defecto en UTC).
2. Buscar socios con `last_checkin_date < ayer` y `current_streak > 0`.
3. No resetear si aplica alguna excepción:
   - `streak_freeze_until` activo (renovación de membresía).
   - Gym reactivado en los últimos 7 días (`last_reactivated_at`).
   - Todos los días entre `last_checkin_date` y "ayer" fueron cerrados (`opening_config`).
4. Actualizar `current_streak = 0` para los elegibles.

---

## Zona horaria (pendiente)

**Estado actual:** Se usa la zona horaria del servidor (UTC). "Ayer" se calcula en UTC.

**Futuro:** Si hay gyms en distintas zonas horarias, cada gym debería tener su propia zona (`Gym.timezone`, ej. `America/Mexico_City`). El cron calcularía "ayer" en la zona de cada gym y aplicaría la lógica según esa fecha. Ver roadmap en `CHANGELOG_AND_ROADMAP.md`.

---

## Respuesta

```json
{
  "ok": true,
  "message": "Streak reset job completed.",
  "total_reset": 15,
  "gyms": [
    {
      "gym_id": "uuid",
      "gym_name": "PowerFit",
      "reset_count": 5,
      "user_ids": ["id1", "id2", ...]
    }
  ]
}
```

---

## Referencias

| Doc | Contenido |
|-----|-----------|
| **GAMIFICACION_PREMIOS_RACHA.md** | Configuración de premios por racha. |
| **SUBSCRIPTION_EXPIRY_AND_RENEWAL.md** | Sección 7: congelar racha (vencimiento, gym reactivado, días cerrados). |
