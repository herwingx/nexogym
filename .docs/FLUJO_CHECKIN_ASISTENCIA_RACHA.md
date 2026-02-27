# Flujo de Check-in, Asistencia y Racha

Revisión del flujo de escáner QR, biométrico y asistencia, con énfasis en qué estados se actualizan en cada check-in y cómo funciona la racha con varios socios.

---

## 1. Resumen de actualización por check-in

| Tipo de check-in   | Visit | User.last_visit_at | User.last_checkin_date | User.current_streak | User.streak_freeze_until |
|--------------------|-------|--------------------|------------------------|---------------------|---------------------------|
| Socio (QR/manual)  | Sí    | Sí                 | Sí (si gamificación)   | Sí (si gamificación)| Se limpia si aplica       |
| Socio (biométrico) | Sí    | Sí                 | Sí (si gamificación)   | Sí (si gamificación)| —                         |
| Staff              | Sí    | Sí                 | No                     | No                  | —                         |
| Cortesía           | Sí    | No                 | No                     | No                  | —                         |

Todos los check-ins válidos crean un registro en `Visit`. Solo staff, QR y biométrico actualizan `last_visit_at` y racha; cortesía solo crea la visita (auditoría).

---

## 2. Flujos de entrada

### 2.1 QR / Manual (`POST /checkin`)

- **Validación:** Código QR (`GYM_QR_<qr_token>`) o `userId`.
- **Usuario:** Socio o staff. Staff no usa racha ni suscripción.
- **Socio:** Requiere suscripción ACTIVE y `expires_at > hoy`.
- **Anti-passback:** 2 horas entre visitas (permite varias visitas por día si pasan ≥2h).
- **Racha:** Usa `last_checkin_date` (día calendario). Mismo día → no suma; ayer → +1; >1 día → reset o excepciones.

### 2.2 Biométrico (`POST /biometric/checkin`)

- **Identificación:** `footprint_id` → `pin_hash` del usuario.
- **Suscripción:** Igual que QR/manual (ACTIVE, expires_at > hoy).
- **Anti-passback:** 4 horas (hardware físico).
- **Racha:** Misma lógica que check-in QR, basada en `last_checkin_date`, respetando excepciones (gym reactivado, streak_freeze_until, días cerrados).

### 2.3 Cortesía (`POST /checkin/courtesy`)

- **Permiso:** Admin, SuperAdmin o Recepcionista.
- **Auditoría:** `COURTESY_ACCESS_GRANTED` con motivo y visit_id.
- **No actualiza:** `last_visit_at`, `last_checkin_date`, `current_streak`.

---

## 3. Estados que se actualizan en cada check-in (socio)

En un check-in exitoso de socio (QR, manual o biométrico) con gamificación activa:

1. **Visit:** Nueva fila con `gym_id`, `user_id`, `check_in_time`, `access_method`, `access_type`.
2. **User.last_visit_at:** Siempre se actualiza al momento del check-in (anti-passback).
3. **User.last_checkin_date:** Se actualiza al inicio del día actual (UTC) cuando aplica racha.
4. **User.current_streak:** Se recalcula según la lógica de racha.
5. **User.streak_freeze_until:** Se pone en `null` cuando el socio usa la ventana de renovación tardía.

Todo se hace en una transacción Prisma (Visit + User) para consistencia.

---

## 4. Flujo con varios socios

- Cada check-in es por un único `userId`.
- La transacción afecta solo a ese usuario (prisma.user.update where id = userId).
- No hay dependencia entre socios; el check-in de A no bloquea ni altera el de B.
- La racha se calcula con los datos actuales de ese socio (`last_checkin_date`, `current_streak`, etc.) al momento del check-in.

---

## 5. Job de reset de rachas

- **Job:** `streak-reset.job.ts`, invocado por `POST /webhooks/streak-reset`.
- **Condición:** Usuarios con `last_checkin_date < ayer` y `current_streak > 0`.
- **Excepciones:** `streak_freeze_until`, gym reactivado últimos 7 días, todos los días intermedios fueron cerrados.
- **Importante:** Tanto el check-in QR como el biométrico deben actualizar `last_checkin_date` para que el job no resetee incorrectamente a socios que sí asistieron.

---

## 6. Anti-passback

| Canal     | Horas mínimas entre visitas |
|-----------|-----------------------------|
| QR/Manual | 2                           |
| Biométrico| 4                           |

El biométrico usa 4h porque el torniquete físico es más estricto. Ambos usan `last_visit_at` para calcular el tiempo transcurrido.
