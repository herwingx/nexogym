# Gamificación — Premios por racha

## Alcance

- **Módulo:** `gamification`. Solo disponible en planes **no BASIC** (PRO_QR, PREMIUM_BIO). En BASIC el menú de gamificación no se muestra y la API de configuración devuelve 403.
- **Admin:** puede configurar los premios por racha de su gym (días consecutivos de visita → texto del premio).
- **Socio:** en el portal ve racha actual, mensaje "Estás participando por racha para los siguientes premios" con la lista configurada por el gym, próximo premio e hitos.

## Configuración (Admin)

- **Ruta:** `/admin/rewards` (ítem **Gamificación** en el menú lateral, solo si el plan tiene `gamification`).
- **API:**
  - `GET /api/v1/gym/rewards-config` — devuelve `{ streak_rewards: [{ days, label }, ...] }`.
  - `PATCH /api/v1/gym/rewards-config` — body `{ streak_rewards }`. Validación: días ≥ 1, label 1–120 caracteres, máx. 20 hitos, sin días duplicados.

El backend guarda en `Gym.rewards_config.streak_rewards`. Se admite formato legacy (`rewards_config` con claves numéricas o `streak_bonus`); el helper unificado en `backend/src/utils/rewards-config.ts` interpreta ambos.

## Portal del socio

- **Ruta:** `/member/rewards`.
- **Datos:** `GET /api/v1/members/me` devuelve `current_streak`, `next_reward` (label y días del próximo hito) y `streak_rewards` (lista de premios del gym).
- **UX:** Si el gym tiene `streak_rewards` configurados, se muestra el bloque "Estás participando por racha para los siguientes premios" con la lista; los hitos de la sección "Hitos" usan esa configuración. Si no hay configuración, se usan hitos por defecto (7, 14, 21, 30, 60, 90 días).

## Check-in y notificación

- En cada check-in (QR, manual o biométrico), si la racha del socio coincide con un hito configurado, se considera premio desbloqueado.
- Si n8n está configurado, el backend envía el evento de recompensa con el `label` del premio para que se notifique por WhatsApp (ver `CANALES_COMUNICACION.md`).

## Formato de `rewards_config` (recomendado)

```json
{
  "streak_rewards": [
    { "days": 7, "label": "Batido gratis" },
    { "days": 30, "label": "Mes gratis" }
  ]
}
```

El backend acepta además formato legacy (claves numéricas `"7": "Batido gratis"` o `streak_bonus: { streak_7: 50 }`) para compatibilidad; `streak_rewards` tiene prioridad cuando existe.
