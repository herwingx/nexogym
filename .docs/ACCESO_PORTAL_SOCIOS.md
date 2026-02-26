# Acceso al portal de socios (email y contraseña)

## Cómo se maneja

- **Acceso a la plataforma de socios es por correo y contraseña** (Supabase Auth). No hay login por número de teléfono.
- El **teléfono** se usa para WhatsApp (bienvenida, QR, premios) y para identificación en recepción; no para iniciar sesión en la app.

## Alta en el gym (crear socio)

- **Teléfono:** obligatorio. Se envía mensaje de bienvenida y QR por WhatsApp (n8n).
- **Email:** opcional en el formulario actual.
  - **Si no se indica email:** el socio no tiene cuenta para el portal. Solo puede usar el QR físico/WhatsApp para entrar al gym; no puede abrir la app e iniciar sesión.
  - **Si se indica email válido:** el backend crea un usuario en Supabase con ese email y una **contraseña temporal** aleatoria, y pone `user_metadata.must_change_password: true`. Luego envía por **correo** (n8n, evento `member_welcome`) las credenciales: email, contraseña temporal, enlace al login, QR y PIN como respaldo. El socio puede entrar al portal con email + contraseña temporal y en el **primer login** la app le pide **cambiar la contraseña** (modal bloqueante).

Flujo resumido cuando hay email en el alta:

1. Recepción/Admin da de alta al socio con **email** (y teléfono).
2. Backend: crea `User` en BD, genera contraseña temporal, crea usuario en Supabase con `must_change_password: true`, envía email con credenciales (temp_password, login_url, qr_data, pin).
3. Socio recibe el correo, entra a la URL de login, usa **email + contraseña temporal**.
4. Tras login, el frontend carga el contexto y ve `must_change_password: true` → muestra **MustChangePasswordModal** (bloqueante) hasta que el socio pone una contraseña nueva.
5. Tras cambiar, se actualiza Supabase (`must_change_password: false`) y el socio queda con acceso normal al portal.

## Email opcional en todos los planes

- **El email es opcional** tanto en BASIC como en planes con portal (PRO_QR, PREMIUM_BIO). Así se puede registrar a socios que no quieren usar el portal, no tienen correo o son de edad muy avanzada y no lo usan.
- **Si se indica email válido en el alta:** se crea cuenta en Supabase, se envían credenciales por correo y el socio puede acceder al portal.
- **Si no se indica email:** el socio queda solo con QR/WhatsApp para entrada al gym. Más adelante, desde la ficha del socio (Editar socio), el staff puede usar **«Enviar acceso al portal»** indicando el correo en el modal; el backend envía las credenciales por correo y el socio pasa a tener acceso.

## Subida de plan BASIC a plan con QR (portal)

- Cuando un gym **pasa de BASIC a un plan con portal** (PRO_QR, PREMIUM_BIO, etc.), los socios que se dieron de alta **sin email** (o sin cuenta) **no tienen acceso al portal** hasta que se les habilite.
- No se crean cuentas en masa de forma automática: muchos socios en BASIC pueden no tener correo registrado, y el correo no se puede inventar. Por tanto:
  - **El staff (recepción o admin) habilita el acceso de forma individual**: en la ficha del socio (Editar socio), si el gym tiene portal y el socio **aún no tiene acceso** (`auth_user_id` nulo), se muestra el botón **«Enviar acceso al portal»**.
  - Al pulsarlo se abre un modal pidiendo **el correo del socio**. Se valida y se llama al endpoint `POST /users/:id/send-portal-access` con `{ email }`.
  - El backend: comprueba que el socio es MEMBER del gym, no tiene `auth_user_id`, y que el gym tiene `qr_access`; crea usuario en Supabase (email + contraseña temporal, `must_change_password: true`), actualiza `User.auth_user_id` y opcionalmente el PIN (para incluirlo en el correo); envía el mismo correo de bienvenida al portal (`sendMemberWelcomeEmail`). El socio recibe credenciales y debe cambiar la contraseña en el primer inicio de sesión.
- **Comportamiento del botón:** solo se muestra cuando el gym tiene `qr_access` y el socio no tiene acceso al portal (`!auth_user_id`). Si el socio ya tiene cuenta, el botón no aparece. No se hace ninguna consulta extra: el listado de socios (`GET /users?role=MEMBER`) y la búsqueda (`GET /users/search`) ya devuelven `auth_user_id` por socio; al abrir Editar socio (desde la tabla o desde búsqueda) se usa ese dato para mostrar u ocultar el botón.

## Recuperación de contraseña (olvidé mi contraseña)

- En la **pantalla de login** hay un enlace **«Olvidé mi contraseña»** que usa el flujo de recuperación de Supabase (envío de enlace por correo). Cualquier socio (o staff) con cuenta asociada a un email puede recuperar el acceso así; no hace falta que el staff les “reenvíe” acceso desde el panel, salvo que no tengan cuenta aún (caso anterior).

Referencia de código:

- Backend: `createUser` en `user.controller.ts` (email opcional, `hasMemberEmail` → Supabase createUser con temp password y `must_change_password: true`, luego `sendMemberWelcomeEmail`). `sendPortalAccess` en el mismo controller para socios sin cuenta.
- Frontend: Login por email + contraseña (`Login.tsx`), enlace «Olvidé mi contraseña», `MustChangePasswordModal` y `ProtectedRoute` muestran el modal cuando `mustChangePassword` es true. Botón «Enviar acceso al portal» en `EditMemberForm` cuando `modulesConfig.qr_access` y `!member.auth_user_id`.
