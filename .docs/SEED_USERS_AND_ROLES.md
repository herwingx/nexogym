# Usuarios, roles y planes del seed — Guía para comprobar permisos

Documento de referencia para saber **quién puede hacer qué** en cada gym según su **rol** y el **plan** del gym. Incluye credenciales para acceder, qué debes verificar que **sí esté** y qué **no esté** disponible, y un **checklist explícito por plan** (§6) para revisar que todo funciona correctamente tras el seed o cambios en permisos.

---

## 1. Roles del sistema

| Rol            | Descripción                    | Dónde entra           | Qué puede hacer (según plan del gym) |
|----------------|--------------------------------|------------------------|--------------------------------------|
| **SUPERADMIN** | Administrador de la plataforma | `/saas` (dashboard SaaS) | Ver todos los gyms, métricas, cambiar tier y módulos por gym, crear/editar/eliminar gyms. No opera un gym concreto. |
| **ADMIN**      | Dueño/gerente del gym          | `/admin`               | Dashboard, Socios, Finanzas, Auditoría, **Personal** (staff, dar de baja); **Inventario y Cortes** (y Forzar Cierre) solo si el plan tiene POS; **Clases y Rutinas** solo si el plan tiene Clases. |
| **RECEPTIONIST** | Recepcionista                | `/reception`           | Check-in, POS (si plan tiene POS), cierre ciego de turno, egresos tipados, ver/alta socios. Check-in por QR solo si el plan tiene `qr_access`. Regenerar QR solo Admin. |
| **COACH**      | Entrenador / rutinas           | `/admin` (menú limitado) | Solo **Clases** y **Rutinas**; no ve Dashboard, Socios, Finanzas, Personal, Cortes ni Auditoría. Default al entrar: `/admin/routines`. |
| **INSTRUCTOR** | Instructor de clases           | `/admin` (menú limitado) | Misma UI que COACH (Clases y Rutinas). Si el backend no incluye INSTRUCTOR en permisos de rutinas/asistencia, esas llamadas devolverán 403 hasta que se actualice. |
| **MEMBER**     | Socio del gym                  | `/member` (portal socio) | Ver su perfil, historial de visitas, premios (si plan tiene gamificación), reservar clases (si plan tiene clases). |

---

## 2. Planes y módulos (qué incluye cada plan)

El **plan del gym** define qué funcionalidades están habilitadas. Lo que no está en el plan debe estar **bloqueado** en menús y APIs (403).

| Plan          | POS (Inventario / Cortes / ventas) | QR (check-in con código) | Clases y Rutinas | Gamificación (rachas, premios) | Biometría (check-in huella) |
|---------------|-------------------------------------|---------------------------|-------------------|---------------------------------|------------------------------|
| **BASIC**     | ✅ Sí                               | ❌ No                     | ❌ No             | ❌ No                           | ❌ No                        |
| **PRO_QR**    | ✅ Sí                               | ✅ Sí                     | ✅ Sí             | ✅ Sí                           | ❌ No                        |
| **PREMIUM_BIO** | ✅ Sí                             | ✅ Sí                     | ✅ Sí             | ✅ Sí                           | ✅ Sí                        |

**Qué comprobar por plan:**

- **BASIC:** Solo debe verse/operar POS (inventario, cortes, ventas). Sin menú Clases, Rutinas, Premios; check-in solo manual (sin QR). Sin biometría.
- **PRO_QR:** Todo lo de BASIC + QR, Clases, Rutinas, Gamificación (rachas, premios). Sin biometría.
- **PREMIUM_BIO:** Todo lo de PRO_QR + check-in biométrico.

---

## 3. Credenciales de acceso (email / contraseña)

Contraseñas usadas en el seed (mismo patrón para recordar):

- Admins: **Admin1234!**
- Recepcionistas: **Recep1234!**
- Instructores: **Instructor1234!**
- Socios (members): **Member1234!** (en PowerFit también existe **Socio1234!** para el socio con login)

---

## 4. Gyms y usuarios por plan

### 4.1 SuperAdmin (plataforma, no es un gym de cliente)

| Usuario | Email                     | Contraseña      | Uso |
|---------|---------------------------|-----------------|-----|
| SuperAdmin | superadmin@nexogym.dev | SuperAdmin2025! | Entrar a `/saas`, listar gyms, cambiar tier, editar módulos. |

---

### 4.2 Plan BASIC — FitZone Básico

**Gym:** FitZone Básico · Plan: **BASIC**

| Rol        | Email               | Contraseña   | Qué debe poder | Qué NO debe poder |
|------------|---------------------|--------------|----------------|-------------------|
| Admin      | admin@fitzone.dev   | Admin1234!   | Dashboard, Socios, Finanzas, Auditoría, **Inventario, Cortes de caja** | Clases, Rutinas (menú no debe aparecer; API 403) |
| Recep      | recep@fitzone.dev   | Recep1234!   | Check-in **manual**, POS, Socios, Alta socios | Check-in por QR, Premios/Gamificación, Clases |
| Socio      | member@fitzone.dev  | Member1234!  | Portal socio, historial visitas (si aplica) | Premios, reservar clases (plan sin clases) |

**Nota:** En BASIC no hay usuarios con rol INSTRUCTOR en el seed.

**Socios/clientes en este gym (para probar listados y estados):**

- Varios socios con suscripción **ACTIVE**, **EXPIRED**, **CANCELED**, **FROZEN** y uno con restricción horaria (allowed_start_time / allowed_end_time). El que tiene login para portal es el que usa `member@fitzone.dev`.

---

### 4.3 Plan BASIC — IronHouse BASIC (segundo gym mismo plan)

**Gym:** IronHouse BASIC · Plan: **BASIC**

| Rol   | Email                 | Contraseña   | Qué debe poder | Qué NO debe poder |
|-------|------------------------|--------------|----------------|-------------------|
| Admin | admin@ironhouse.dev   | Admin1234!   | Igual que FitZone BASIC: POS, Socios, Finanzas, Auditoría | Clases, Rutinas |
| Recep | recep@ironhouse.dev   | Recep1234!   | Check-in manual, POS, Socios | QR, Clases, Premios |
| Socio | member@ironhouse.dev | Member1234!  | Portal socio básico | Premios, Clases |

**Comprobar:** Los datos (socios, ventas, visitas) son **solo de IronHouse**; no deben verse datos de FitZone ni de otros gyms.

---

### 4.4 Plan PRO_QR — PowerFit Pro

**Gym:** PowerFit Pro · Plan: **PRO_QR**

| Rol        | Email                    | Contraseña     | Qué debe poder | Qué NO debe poder |
|------------|--------------------------|----------------|----------------|-------------------|
| Admin      | admin@powerfit.dev      | Admin1234!     | Todo lo de BASIC + **Clases, Rutinas**, Inventario, Cortes | Biometría (check-in huella) |
| Recep      | recep@powerfit.dev      | Recep1234!     | Check-in **manual y QR**, POS, Socios, Clases (según permisos) | Biometría |
| Instructor | instructor@powerfit.dev | Instructor1234! | Ver/gestionar clases del gym | Lo que no sea clases/instructor |
| Socio      | socio@powerfit.dev      | Socio1234!     | Portal: inicio, **premios**, historial, **reservar clases** | Nada de biometría en app (solo backend/hardware) |

**Socios en este gym:** Varios con ACTIVE, EXPIRED, CANCELED, FROZEN; algunos con rachas (streaks) y restricción horaria. El socio con login es el que usa `socio@powerfit.dev`.

---

### 4.5 Plan PRO_QR — CrossBox PRO (segundo gym mismo plan)

**Gym:** CrossBox PRO · Plan: **PRO_QR**

| Rol        | Email                     | Contraseña     | Qué debe poder | Qué NO debe poder |
|------------|----------------------------|----------------|----------------|-------------------|
| Admin      | admin@crossbox.dev        | Admin1234!     | Igual que PowerFit: POS, Clases, Rutinas, Socios, Finanzas | Biometría |
| Recep      | recep@crossbox.dev        | Recep1234!     | Check-in manual y QR, POS, Socios | Biometría |
| Instructor | instructor@crossbox.dev   | Instructor1234! | Clases del gym | Datos de otros gyms |
| Socio      | member@crossbox.dev       | Member1234!    | Portal: premios, clases | Biometría |

**Comprobar:** Datos aislados de PowerFit; mismo conjunto de opciones (PRO sin biometría).

---

### 4.6 Plan PREMIUM_BIO — EliteBody Premium

**Gym:** EliteBody Premium · Plan: **PREMIUM_BIO**

| Rol        | Email                     | Contraseña     | Qué debe poder | Qué NO debe poder |
|------------|----------------------------|----------------|----------------|-------------------|
| Admin      | admin@elitebody.dev       | Admin1234!     | Todo: POS, Clases, Rutinas, Socios, Finanzas, Auditoría; gym puede usar biometría | Nada bloqueado por plan |
| Recep      | recep@elitebody.dev       | Recep1234!     | Check-in manual, QR y **biométrico**, POS, Socios, Clases | — |
| Instructor | instructor@elitebody.dev  | Instructor1234! | Clases del gym | — |
| Socio      | member@elitebody.dev      | Member1234!    | Portal: premios, clases, historial | — |

**Socios en este gym:** Varios con ACTIVE, EXPIRED, CANCELED, FROZEN; el que tiene login es el que usa `member@elitebody.dev`.

---

### 4.7 Plan PREMIUM_BIO — MegaFit PREMIUM (segundo gym mismo plan)

**Gym:** MegaFit PREMIUM · Plan: **PREMIUM_BIO**

| Rol        | Email                    | Contraseña     | Qué debe poder | Qué NO debe poder |
|------------|---------------------------|----------------|----------------|-------------------|
| Admin      | admin@megafit.dev        | Admin1234!     | Todo (igual que EliteBody) | — |
| Recep      | recep@megafit.dev        | Recep1234!     | Check-in manual, QR, biométrico, POS, Socios | — |
| Instructor | instructor@megafit.dev   | Instructor1234! | Clases del gym | — |
| Socio      | member@megafit.dev       | Member1234!    | Portal completo | — |

**Comprobar:** Datos solo de MegaFit; mismas opciones que EliteBody (todo habilitado).

---

## 5. Resumen: a qué gym pertenece cada cliente (socios con login)

| Email / usuario          | Gym            | Plan          | Rol      | Estado típico en seed |
|--------------------------|----------------|---------------|----------|------------------------|
| member@fitzone.dev       | FitZone Básico | BASIC         | MEMBER   | ACTIVE                 |
| member@ironhouse.dev     | IronHouse BASIC| BASIC         | MEMBER   | ACTIVE                 |
| socio@powerfit.dev       | PowerFit Pro   | PRO_QR        | MEMBER   | ACTIVE                 |
| member@crossbox.dev      | CrossBox PRO   | PRO_QR        | MEMBER   | ACTIVE                 |
| member@elitebody.dev     | EliteBody Premium | PREMIUM_BIO | MEMBER   | ACTIVE                 |
| member@megafit.dev       | MegaFit PREMIUM| PREMIUM_BIO   | MEMBER   | ACTIVE                 |

Cada socio solo debe ver **su gym** y las opciones que el **plan de ese gym** permite (ej. en BASIC no premios ni reserva de clases).

---

## 6. Qué revisar en cada plan — Checklist explícito de verificación

Usa esta sección **tras ejecutar el seed** o tras cambios en permisos/planes para asegurarte de que todo funciona correctamente. Marca cada ítem al comprobarlo.

**Orden sugerido de pruebas:** SuperAdmin → BASIC (FitZone o IronHouse) → PRO_QR (PowerFit o CrossBox) → PREMIUM_BIO (EliteBody o MegaFit). En cada plan, probar Admin, luego Recep, luego Instructor (si aplica) y por último Socio.

---

### 6.1 SuperAdmin (plataforma)

| # | Acción | Resultado esperado | ✓ |
|---|--------|--------------------|---|
| 1 | Login con `superadmin@nexogym.dev` / `SuperAdmin2025!` | Acceso a `/saas` sin error |
| 2 | Navegar al listado de gyms | Se ven todos los gyms (FitZone, IronHouse, PowerFit, CrossBox, EliteBody, MegaFit) |
| 3 | Abrir un gym y revisar tier/módulos | Se puede ver y editar plan (BASIC/PRO_QR/PREMIUM_BIO) y módulos |
| 4 | Intentar acceder a `/admin` o `/reception` sin elegir gym | No debe operar como recepción/admin de un gym concreto; flujo correcto según app |

---

### 6.2 Plan BASIC (FitZone Básico o IronHouse BASIC)

**Gym de prueba:** FitZone — `admin@fitzone.dev`, `recep@fitzone.dev`, `member@fitzone.dev`

| # | Rol | Acción | Resultado esperado | ✓ |
|---|-----|--------|--------------------|---|
| 1 | Admin | Login y revisar menú lateral/navegación | **Visible:** Dashboard, Socios, Finanzas, Auditoría, Inventario, Cortes. **No visible:** Clases, Rutinas, Premios/Gamificación |
| 2 | Admin | Abrir Inventario / Cortes de caja | Página carga y permite operar (listar, crear según permisos) |
| 3 | Admin | Si existe enlace o ruta a Clases/Rutinas | Menú no muestra opción; acceso directo por URL debe dar 403 o redirección |
| 4 | Recep | Login y revisar recepción (check-in, POS) | Check-in **solo manual** (por DNI/búsqueda). **No** opción de escanear QR para check-in |
| 5 | Recep | Abrir POS / ventas | Funciona; puede vender y ver productos del gym |
| 6 | Recep | Buscar “QR” o “código” en pantalla de check-in | No hay flujo de check-in por QR habilitado (botón oculto o deshabilitado / 403) |
| 7 | Socio | Login en portal socio (`member@fitzone.dev`) | Acceso a portal; ve su perfil e historial de visitas |
| 8 | Socio | Buscar premios, rachas o reserva de clases | No visible o bloqueado (mensaje/403); plan BASIC no incluye gamificación ni clases |
| 9 | — | Aislamiento: como Admin o Recep, listar socios/ventas | Solo datos de **este gym** (FitZone o IronHouse); ningún dato de PowerFit/CrossBox/EliteBody/MegaFit |

**Repetir los mismos criterios con IronHouse** (`admin@ironhouse.dev`, `recep@ironhouse.dev`, `member@ironhouse.dev`) y confirmar que los datos mostrados son solo de IronHouse.

---

### 6.3 Plan PRO_QR (PowerFit Pro o CrossBox PRO)

**Gym de prueba:** PowerFit — `admin@powerfit.dev`, `recep@powerfit.dev`, `instructor@powerfit.dev`, `socio@powerfit.dev`

| # | Rol | Acción | Resultado esperado | ✓ |
|---|-----|--------|--------------------|---|
| 1 | Admin | Login y revisar menú | **Visible:** Dashboard, Socios, Finanzas, Auditoría, Inventario, Cortes, **Clases, Rutinas**. **No visible:** Biometría (si se muestra en otros planes) |
| 2 | Admin | Abrir Clases / Rutinas | Páginas cargan y permiten gestionar (según permisos) |
| 3 | Recep | Pantalla de check-in | Opción de check-in **manual** y **por QR** (escanear código). Ambas funcionan |
| 4 | Recep | Buscar opción de check-in biométrico (huella) | No disponible o deshabilitado; plan PRO_QR no incluye biometría |
| 5 | Instructor | Login (`instructor@powerfit.dev`) | Acceso a área de instructor / clases del gym |
| 6 | Instructor | Ver y gestionar clases | Solo clases del gym PowerFit; no ve datos de otros gyms |
| 7 | Socio | Login en portal (`socio@powerfit.dev`) | Ve **premios/gamificación** (rachas, etc.) y **reserva de clases** |
| 8 | Socio | Reservar una clase (si hay clases en el seed) | Flujo funciona o muestra mensaje coherente (ej. sin clases disponibles) |
| 9 | — | Aislamiento: como Recep/Admin, listar socios y ventas | Solo datos de PowerFit (o CrossBox si pruebas CrossBox); ningún dato de FitZone/EliteBody/etc. |

**Repetir con CrossBox** (`admin@crossbox.dev`, etc.) y comprobar mismo comportamiento y aislamiento de datos.

---

### 6.4 Plan PREMIUM_BIO (EliteBody Premium o MegaFit PREMIUM)

**Gym de prueba:** EliteBody — `admin@elitebody.dev`, `recep@elitebody.dev`, `instructor@elitebody.dev`, `member@elitebody.dev`

| # | Rol | Acción | Resultado esperado | ✓ |
|---|-----|--------|--------------------|---|
| 1 | Admin | Login y revisar menú | Todo lo de PRO_QR visible; además opciones de biometría/configuración premium si aplican |
| 2 | Admin | Navegar por todas las secciones (Socios, Finanzas, Inventario, Cortes, Clases, Rutinas) | Todas cargan sin 403 |
| 3 | Recep | Pantalla de check-in | Check-in **manual**, **QR** y **biométrico** (si está implementado en frontend/hardware) |
| 4 | Recep | POS y socios | Funcionan con normalidad |
| 5 | Instructor | Ver/gestionar clases | Solo clases de EliteBody (o MegaFit); aislamiento correcto |
| 6 | Socio | Portal: premios, clases, historial | Todo accesible según diseño del portal |
| 7 | — | Aislamiento: listar socios/ventas/visitas como Admin o Recep | Solo datos de **este gym** (EliteBody o MegaFit) |

**Repetir con MegaFit** y confirmar mismo nivel de acceso y aislamiento.

---

### 6.5 Resumen de reglas que deben cumplirse siempre

- **Por plan:** Lo que no está en el plan (tabla de §2) debe estar **oculto en UI** o devolver **403** en API.
- **Por rol:** Cada rol solo ve y hace lo indicado en la tabla de §1; el plan del gym recorta aún más (ej. Recep en BASIC no tiene QR).
- **Aislamiento:** Un usuario de un gym **nunca** ve socios, ventas, visitas o clases de otro gym.
- **Login:** Todas las credenciales de §7 deben permitir login correcto; contraseña errónea debe rechazarse con mensaje claro.

---

## 7. Contraseñas en un solo bloque (copiar/pegar)

```
SuperAdmin : superadmin@nexogym.dev   / SuperAdmin2025!

FitZone (BASIC):
  admin@fitzone.dev     / Admin1234!
  recep@fitzone.dev     / Recep1234!
  member@fitzone.dev    / Member1234!

IronHouse (BASIC):
  admin@ironhouse.dev   / Admin1234!
  recep@ironhouse.dev   / Recep1234!
  member@ironhouse.dev  / Member1234!

PowerFit (PRO_QR):
  admin@powerfit.dev      / Admin1234!
  recep@powerfit.dev      / Recep1234!
  instructor@powerfit.dev / Instructor1234!
  socio@powerfit.dev       / Socio1234!

CrossBox (PRO_QR):
  admin@crossbox.dev      / Admin1234!
  recep@crossbox.dev      / Recep1234!
  instructor@crossbox.dev  / Instructor1234!
  member@crossbox.dev     / Member1234!

EliteBody (PREMIUM_BIO):
  admin@elitebody.dev     / Admin1234!
  recep@elitebody.dev     / Recep1234!
  instructor@elitebody.dev/ Instructor1234!
  member@elitebody.dev    / Member1234!

MegaFit (PREMIUM_BIO):
  admin@megafit.dev       / Admin1234!
  recep@megafit.dev       / Recep1234!
  instructor@megafit.dev   / Instructor1234!
  member@megafit.dev      / Member1234!
```

---

*Documento generado para el seed de Prisma. Tras ejecutar `npx prisma db seed` en el backend, estos usuarios y gyms están disponibles para comprobar permisos y restricciones por plan.*
