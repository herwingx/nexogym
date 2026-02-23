# Product Requirements Document (PRD)

## Visión del Producto
SaaS B2B para gimnasios locales enfocado en bajo costo de hardware y alta retención. El sistema abarca control de acceso (Manual, QR y Biométrico), Punto de Venta (POS), Cortes de Caja y un Portal de Gamificación para los clientes.

## Casos de Uso Principales (User Journeys)
1. **Cobro y Caja:** El recepcionista cobra una mensualidad y el sistema abre turno de caja.
2. **Acceso:** El cliente llega y escanea su código QR (vía escáner USB en PC o cámara móvil).
3. **Gamificación y Notificaciones:** El sistema valida el acceso, suma una racha (🔥) y envía un WhatsApp automático si hay premio u objetivo alcanzado.

## Estructura de Permisos (RBAC)
- **SuperAdmin:** Dueño del SaaS. Acceso global para crear y gestionar tenants (gimnasios).
- **Admin:** Dueño del gimnasio. Puede configurar colores corporativos, recompensas, ver reportes completos y gestionar personal.
- **Recepcionista:** Operación diaria. Puede registrar usuarios, cobrar mensualidades, vender artículos del POS, realizar cortes de caja y registrar visitas manualmente si es necesario.
- **Cliente:** Acceso al Portal de Gamificación. Puede ver su progreso, rachas, recompensas, membresía activa y displayar su código QR virtual.
