```
███╗   ██╗███████╗██╗  ██╗ ██████╗  ██████╗ ██╗   ██╗███╗   ███╗
████╗  ██║██╔════╝╚██╗██╔╝██╔═══██╗██╔════╝ ╚██╗ ██╔╝████╗ ████║
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║██║  ███╗ ╚████╔╝ ██╔████╔██║
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║██║   ██║  ╚██╔╝  ██║╚██╔╝██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝╚██████╔╝   ██║   ██║ ╚═╝ ██║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝   ╚═╝   ╚═╝     ╚═╝
```

> **Conecta al dueño, al staff y a los clientes.**
> ERP multitenant de alto rendimiento para la gestión de gimnasios.

---

![Node](https://img.shields.io/badge/Node.js-18%2B-6ee7b7?style=flat-square&logo=node.js&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-818cf8?style=flat-square&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7.x-c4b5fd?style=flat-square&logo=prisma&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-34d399?style=flat-square&logo=supabase&logoColor=black)
![Vitest](https://img.shields.io/badge/Vitest-tested-f59e0b?style=flat-square&logo=vitest&logoColor=black)
![CI](https://img.shields.io/github/actions/workflow/status/herwingx/gym-saas/ci.yml?style=flat-square&label=CI&logo=github&logoColor=white)

---

## Stack

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 18+ · TypeScript 5 · Express 5 |
| Base de datos | PostgreSQL vía Supabase (autohosteado) |
| ORM | Prisma 7 |
| Auth | Supabase Auth — JWT + `auth_user_id` |
| Observabilidad | Pino logs · Prometheus metrics · Swagger UI |
| Tests | Vitest · Supertest · vitest-mock-extended |
| Mensajería | n8n webhooks (WhatsApp — opcional) |
| CI | GitHub Actions |

---

## Módulos

| Módulo | Plan |
|---|---|
| 🛒 POS — Punto de Venta, turnos de caja, egresos tipados (proveedor/operativo/retiro), cierre ciego, forzar cierre (admin) | BASIC · PRO · PREMIUM |
| 📦 Inventario — productos, restock, mermas | BASIC · PRO · PREMIUM |
| 🚪 Check-in — manual, QR, biométrico | BASIC · PRO · PREMIUM |
| 📅 Clases y Reservas | PRO · PREMIUM |
| 🏋️ Rutinas de entrenamiento | PRO · PREMIUM |
| 👥 Personal — listado de staff, dar de baja (soft delete) | Admin (BASIC · PRO · PREMIUM) |
| 🎮 Gamificación — streaks y recompensas | PRO · PREMIUM |
| 🖐 Biometría | PREMIUM |
| 📊 Analytics — ocupación, ingresos, auditoría | BASIC · PRO · PREMIUM |
| 🏢 SaaS Admin — gestión multitenant | SUPERADMIN |

---

## Inicio rápido

```bash
git clone https://github.com/herwingx/gym-saas
cd gym-saas/backend
npm install
cp .env.example .env               # rellenar con credenciales de Supabase DEV
cp prisma/.env.example prisma/.env # rellenar DIRECT_URL
npm run db:push                    # sincronizar schema
npm run db:seed                    # poblar con datos de prueba (dev)
# Para producción con DB vacía: npm run bootstrap-superadmin (ver .docs/BOOTSTRAP_PRODUCCION_PRIMER_ADMIN.md)
npm run dev                        # → http://localhost:3000
```

---

## Comandos

```bash
npm run dev              # servidor en modo watch
npm test                 # suite de pruebas (Vitest)
npm run test:coverage    # reporte de cobertura
npm run typecheck        # validación de tipos sin compilar

npm run db:push          # sincronizar schema con la DB (dev)
npm run db:migrate       # generar migration file versionado
npm run db:seed          # poblar DB con datos de prueba realistas (dev)
npm run bootstrap-superadmin  # crear solo SuperAdmin en producción (DB vacía)
npm run db:reset         # destruir + re-crear + re-seedear
npm run db:studio        # GUI visual de la DB (Prisma Studio)
```

---

## Documentación

| Doc | Descripción |
|---|---|
| [.docs/README.md](./.docs/README.md) | **Índice** de toda la documentación y cambios recientes (POS, caja, personal, roles) |
| [DEV_WORKFLOW.md](./.docs/DEV_WORKFLOW.md) | Entornos, flujo de trabajo, auth, testing manual, seed |
| [SUPABASE_AUTH_EN_EL_PROYECTO.md](./.docs/SUPABASE_AUTH_EN_EL_PROYECTO.md) | Cómo funciona Supabase Auth en el proyecto y ventajas vs login propio |
| [BOOTSTRAP_PRODUCCION_PRIMER_ADMIN.md](./.docs/BOOTSTRAP_PRODUCCION_PRIMER_ADMIN.md) | Primer arranque en producción (DB vacía): **bootstrap-superadmin**, cómo funciona el script y cómo crear SuperAdmin/admin |
| [TESTING_STRATEGY.md](./.docs/TESTING_STRATEGY.md) | Estrategia de pruebas automatizadas |
| [DATABASE_SCHEMA.md](./.docs/DATABASE_SCHEMA.md) | Modelos, relaciones y enums (incl. ExpenseType, Expense, auditoría) |
| [API_SPEC.md](./.docs/API_SPEC.md) | Contratos de la API por sprint (POS, users, turnos, egresos, force-close) |
| [CORTES_CAJA_Y_STOCK.md](./.docs/CORTES_CAJA_Y_STOCK.md) | Turnos de caja, cierre ciego, tipos de egreso, forzar cierre, stock, bloqueo logout |
| [SEED_USERS_AND_ROLES.md](./.docs/SEED_USERS_AND_ROLES.md) | Roles (Admin, Recep, COACH, INSTRUCTOR, Socio), planes, credenciales de prueba |
| [EMAIL_POLITICA_GYM.md](./.docs/EMAIL_POLITICA_GYM.md) | Correos corporativos del gym para staff, dar de baja y reasignación |
| [FRONTEND_INTEGRATION.md](./.docs/FRONTEND_INTEGRATION.md) | Contratos de API para el frontend |
| [BRANCH_PROTECTION.md](./.docs/BRANCH_PROTECTION.md) | Reglas de ramas y PR |
| [GO_LIVE_CHECKLIST.md](./.docs/GO_LIVE_CHECKLIST.md) | Checklist de despliegue a producción |
| Swagger UI | `http://localhost:3000/api-docs` |
| Health | `http://localhost:3000/health` |
| Metrics | `http://localhost:3000/metrics` |

---

## Arquitectura de auth

```
FRONTEND            SUPABASE AUTH              NEXOGYM BACKEND
────────            ─────────────              ───────────────
signIn()  ───────►  valida credenciales
          ◄───────  JWT (access_token)
API req   ──────────────────────────────────►  requireAuth
                    ◄── getUser(token) ──────   verifica JWT
                        user.id        ──────►  resuelve gymId + role
                                               ── next() ──► controlador
```

Supabase maneja: login, registro, refresh, contraseña olvidada.
NexoGym maneja: autorización por rol, contexto multitenant, lógica de negocio.

---

## CI

Pipeline en `.github/workflows/ci.yml` — se ejecuta en cada push y PR a `main`:

```
npm ci  →  prisma generate  →  typecheck  →  vitest  →  audit:high
```

