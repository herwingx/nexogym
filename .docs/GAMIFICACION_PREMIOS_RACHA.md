# Gamificación — Premios por racha

## Alcance

- **Módulo:** `gamification`. Solo disponible en planes **no BASIC** (PRO_QR, PREMIUM_BIO). En BASIC el menú de gamificación no se muestra y la API de configuración devuelve 403.
- **Admin:** puede configurar los premios por racha de su gym (días consecutivos de visita → texto del premio).
- **Socio:** en el portal ve racha actual, mensaje "Estás participando por racha para los siguientes premios" con la lista configurada por el gym, próximo premio e hitos.

## Configuración (Admin)

- **Ruta:** `/admin/rewards` (ítem **Gamificación** en el menú lateral, solo si el plan tiene `gamification`).
- **API:**
  - `GET /api/v1/gym/rewards-config` — devuelve `{ streak_rewards, streak_freeze_days }`.
  - `PATCH /api/v1/gym/rewards-config` — body `{ streak_rewards?, streak_freeze_days? }`. `streak_freeze_days` (1–90, default 7): días de gracia para congelar la racha cuando el socio **no renovó a tiempo** (venció y renueva tarde). No aplica cuando el socio descongela (eligió congelar; no se protege racha). Validación de `streak_rewards`: días ≥ 1, label 1–120 caracteres, máx. 20 hitos, sin días duplicados.

El backend guarda en `Gym.rewards_config` (`streak_rewards`, `streak_freeze_days`). Además, `Gym.opening_config` (`closed_weekdays`, `closed_dates`) permite definir qué días cierra el gym (no afectan la racha). Ver `SUBSCRIPTION_EXPIRY_AND_RENEWAL.md` sección 7 para el flujo de congelar racha y días cerrados. Se admite formato legacy (`rewards_config` con claves numéricas o `streak_bonus`); el helper unificado en `backend/src/utils/rewards-config.ts` interpreta ambos.

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
  ],
  "streak_freeze_days": 7
}
```

`streak_freeze_days`: días de gracia para congelar racha cuando el socio no renovó a tiempo (default 7; rango 1–90). No aplica al descongelar.

### opening_config (días cerrados)

```json
{
  "closed_weekdays": [0, 6],
  "closed_dates": ["01-01", "12-25"]
}
```

- `closed_weekdays`: 0=Dom, 1=Lun, ..., 6=Sab. Días de la semana que el gym cierra.
- `closed_dates`: festivos anuales en formato MM-DD (ej. 01-01, 12-25); máx. 30.

Si todos los días entre el último check-in y hoy fueron cerrados (por weekday o festivo), la racha se congela (no se reinicia). Admin lo configura en Gamificación → "Días que cierra el gym".

El backend acepta además formato legacy (claves numéricas `"7": "Batido gratis"` o `streak_bonus: { streak_7: 50 }`) para compatibilidad; `streak_rewards` tiene prioridad cuando existe.

## Leaderboard (staff)

- **Ruta:** `/admin/leaderboard` o `/reception/leaderboard` (según permiso `can_view_leaderboard`).
- **API:** `GET /api/v1/gym/leaderboard?page=1&limit=20&q=nombre` — socios ordenados por `current_streak` DESC, empate por `last_visit_at` DESC.
- **Paginación y búsqueda:** `page` (default 1), `limit` (5–50, default 20), `q` (mín. 2 caracteres para filtrar por nombre). Respuesta incluye `meta: { total, page, limit }`.
