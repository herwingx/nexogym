# Usuarios, roles y planes del seed — Guía para comprobar permisos

Documento de referencia para saber **quién puede hacer qué** en cada gym según su **rol** y el **plan** del gym. Incluye credenciales para acceder y qué debes verificar que **sí esté** y qué **no esté** disponible.

---

## 1. Roles del sistema

| Rol            | Descripción                    | Dónde entra           | Qué puede hacer (según plan del gym) |
|----------------|--------------------------------|------------------------|--------------------------------------|
| **SUPERADMIN** | Administrador de la plataforma | `/saas` (dashboard SaaS) | Ver todos los gyms, métricas, cambiar tier y módulos por gym, crear/editar/eliminar gyms. No opera un gym concreto. |
| **ADMIN**      | Dueño/gerente del gym          | `/admin`               | Dashboard, Socios, Finanzas, Auditoría; **Inventario y Cortes** solo si el plan tiene POS; **Clases y Rutinas** solo si el plan tiene Clases. |
| **RECEPTIONIST** | Recepcionista                | `/reception`           | Check-in, POS (si plan tiene POS), ver/alta socios. Check-in por QR solo si el plan tiene `qr_access`. |
| **INSTRUCTOR** | Instructor de clases           | `/reception` o área instructor | Ver y gestionar clases del gym (solo si el plan tiene Clases). |
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

## 6. Checklist rápido de qué comprobar

1. **SuperAdmin** (`superadmin@nexogym.dev`): entra a `/saas`, ve todos los gyms, puede cambiar tier y editar módulos; no ve datos de un gym concreto como recepción.
2. **BASIC (FitZone o IronHouse):**
   - Admin/Recep: ven Inventario y Cortes; **no** ven Clases ni Rutinas en el menú.
   - Check-in: solo manual; si hay botón/opción QR debe estar deshabilitado o dar 403.
   - Socio: sin premios ni reserva de clases (o ocultos / 403).
3. **PRO_QR (PowerFit o CrossBox):**
   - Admin/Recep: ven Inventario, Cortes, Clases, Rutinas.
   - Check-in: manual y QR; **no** biometría.
   - Socio: premios y reserva de clases visibles y funcionando.
4. **PREMIUM_BIO (EliteBody o MegaFit):**
   - Todo lo anterior + opción de check-in biométrico (según implementación frontend/hardware).
5. **Aislamiento:** Entrando como Admin o Recep de un gym, solo se ven socios, ventas, visitas y clases **de ese gym**; nunca de otro.

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
