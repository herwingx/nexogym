# GymSaaS ERP - Profesional Backend

ERP Multitenant de alto rendimiento para la gestión de gimnasios.

## Comandos Rápidos

- `npm install` - Instala dependencias.
- `npm run dev` - Levanta el servidor de desarrollo (tsx).
- `npm test` - Corre la suite de pruebas (Vitest).
- `npm run test:coverage` - Reporte de cobertura de código.
- `npx prisma migrate dev` - Aplica cambios en la base de datos.

## Documentación
- **API (Swagger):** `http://localhost:3000/api-docs`
- **Estrategia de Pruebas:** [TESTING_STRATEGY.md](./.docs/TESTING_STRATEGY.md)
- **Schema DB:** [DATABASE_SCHEMA.md](./.docs/DATABASE_SCHEMA.md)

## Requisitos
- Node.js 18+
- PostgreSQL (Supabase)
- n8n (opcional para webhooks de WhatsApp)
