# Arquitectura del Sistema (ARCHITECTURE)

## Stack Tecnológico Estricto
Estas reglas arquitectónicas son definitivas y no se integrarán tecnologías que no estén aquí sin aprobación expresa.

### 1. Frontend (SPA/PWA)
- **Framework:** React (Vite) + TypeScript.
- **Estilos:** Tailwind CSS con variables dinámicas para marca blanca.
- **Gestión de Estado Global:** Zustand.
- **Iconografía:** Lucide React.
- **PWA:** Instalabilidad móvil usando el plugin `vite-plugin-pwa`.
- **Ruteador:** React Router DOM (v6+).

### 2. Backend (API/BFF)
- **Entorno:** Node.js.
- **Framework:** Express + TypeScript.
- **Capa de Datos:** Prisma ORM.

### 3. Base de Datos y Autenticación
- **Plataforma:** Supabase (PostgreSQL) autohosteado.
- **Auth:** Supabase Auth (JWT inyectado en cada petición).

### 4. Automatización y Webhooks
- **Orquestador:** n8n local.
- **Propósito:** Notificaciones de WhatsApp, alertas automáticas. El backend emite `POST` requests hacia los webhooks de n8n.

---

## Regla de Oro: Multitenancy Estricto (¡CRÍTICO!)
El sistema es un SaaS Multi-Tenant.
1. **Aislamiento a nivel de Base de Datos:** Absolutamente toda tabla en Prisma (excepto la tabla central de `Gyms`) DEBE tener un campo `gym_id`.
2. **Aislamiento en las Consultas:** TODA consulta en el backend (GET, POST, PUT, DELETE) debe filtrar obligatoriamente por el `gym_id`.
3. **Flujo de Autorización:** El `gym_id` debe extraerse de forma segura del JSON Web Token (JWT) del usuario logueado en un middleware global y pasarse en el objeto de la petición (`req.user.gymId`).
   - Ejemplo de Prisma: `where: { gym_id: currentGymId, id: itemId }`
   - ¡NO HAY EXCEPCIONES PARA ESTA REGLA!

---

## Lineamientos de Infraestructura
- El backend y el frontend se comunican por una API REST JSON.
- La ejecución temporal del entorno local se orquesta alrededor del backend en el puerto base, y vite en el suyo, interconectados mediante configuración de variables de entorno y proxies (`cors`, `credentials`).
