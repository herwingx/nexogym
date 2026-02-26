# Documentación de usuario — Base para manual

Documento base con funcionalidades aplicadas, pensado para generar la documentación de usuario final. Sirve de índice y resumen operativo por rol.

---

## 1. Visión general

NexoGym es un sistema de gestión para gimnasios que permite:

- **Admin (dueño/gerente):** Gestionar socios, inventario, precios, personal, finanzas y auditoría.
- **Recepción:** Check-in de socios, venta en caja (POS), alta de socios, renovación y gestión de turnos.
- **Coach/Instructor:** Clases, rutinas y asistencia (según plan).
- **Socio:** Portal con QR, premios e historial (solo en planes PRO/PREMIUM; en plan Basic no hay portal).

---

## 2. Planes y acceso

| Plan          | Admin | Recepción | Socio (portal) |
|---------------|-------|-----------|----------------|
| **BASIC**     | POS, Socios, Finanzas, Inventario, Cortes | Check-in manual, POS, Socios | **Sin portal** (bloqueado) |
| **PRO_QR**    | Todo lo de BASIC + Clases, Rutinas | Check-in manual + QR, POS, Socios | Portal: QR, premios, historial, clases |
| **PREMIUM_BIO** | Todo + Biometría | Check-in manual + QR + biométrico | Portal completo |

En plan **Basic**, los socios no tienen acceso al portal; ven una pantalla de bloqueo y pueden cerrar sesión.

---

## 3. Funcionalidades por rol

### 3.1 Admin (dueño/gerente)

#### Inventario
- Crear productos con nombre, precio, código de barras (opcional).
- Editar precios (solo Admin; Recepción no puede modificar).
- Restock, mermas.
- **Producto "Membresía 30 días":** Crear con barcode `MEMBERSHIP` y asignar el precio de la mensualidad; ese precio se usa al renovar socios.

#### Socios
- Listar, editar datos.
- Renovar, congelar, cancelar suscripciones.
- Personal: dar de baja, reactivar.

#### Finanzas y auditoría
- Cortes de caja: historial de turnos cerrados (estado Cuadrado/Sobrante/Faltante).
- Por cada turno, ver **Transacciones**: ventas agrupadas por folio (ticket) con desglose por producto.
- Forzar cierre de turno si un recepcionista salió sin corte.
- Auditoría: registro de acciones críticas (quién hizo qué y cuándo), etiquetas en español.

---

### 3.2 Recepción

#### Check-in
- Check-in manual (búsqueda por nombre/teléfono).
- Check-in por QR (si el plan tiene `qr_access`).
- Check-in de cortesía (acceso temporal para vencidos/cancelados).

#### POS (ventas)
- Vender productos al precio del catálogo (no puede cambiar precios).
- Ver productos y stock.

#### Socios
- Buscar, listar socios.
- Alta de socios.
- **Renovar suscripción:** Usa el precio del producto "Membresía 30 días" configurado por el Admin. No ingresa monto manual.
- Congelar / descongelar suscripción.
- Si el producto Membresía no existe: error claro; el Admin debe crearlo en Inventario.

#### Turnos de caja
- Abrir turno (fondo inicial).
- Cerrar turno (efectivo contado); no ve saldo esperado (cierre ciego).
- Registrar egresos (tipos: pago proveedores, gasto operativo, retiro efectivo).

---

### 3.3 Socio (portal)

Solo disponible en planes **PRO_QR** y **PREMIUM_BIO**. En plan Basic: bloqueado.

- **Inicio:** QR personal, estado de suscripción, racha.
- **Premios:** Gamificación, ranking.
- **Historial:** Visitas.
- **Perfil:** Datos personales.

---

## 4. Flujos clave

### 4.1 Renovación de suscripción

1. Admin crea el producto "Membresía 30 días" en Inventario con barcode `MEMBERSHIP` y asigna el precio.
2. Recepción (o Admin) va a Socios → selecciona socio → Renovar.
3. El sistema cobra automáticamente el precio del producto; se registra en caja si hay turno abierto.
4. No hay input de monto manual; evita manipulación.

### 4.2 Apertura y cierre de turno

1. **Abrir turno:** Ingresar fondo inicial (ej. 500.00).
2. Operar: ventas, egresos.
3. **Cerrar turno:** Contar efectivo físico e ingresar el monto. Confirmar y cerrar.
4. No se puede cerrar sesión con turno abierto; debe hacer corte primero.

### 4.3 Inventario y precios

1. Admin crea productos (nombre, precio, código de barras).
2. Recepción vende productos al precio del catálogo; no puede modificar precios.
3. Solo Admin puede crear, editar y eliminar productos.

---

## 5. Notas técnicas para la documentación de usuario

- **Códigos de barras:** Admite escáner USB tipo teclado; el código se escribe en el campo correspondiente.
- **Productos con mismo barcode:** Todas las unidades comparten el mismo código (ej. 15 botellas de agua = 1 producto, stock 15).
- **Inputs numéricos:** Los campos de monto (fondo inicial, efectivo contado) aceptan decimales con punto o coma.

---

*Documento base generado a partir de la implementación actual. Usar como punto de partida para redactar manuales de usuario, guías rápidas o material de capacitación.*
