import { prisma } from '../db';

/**
 * Registra un evento de auditoría en la tabla AuditLog.
 * Úsalo en CUALQUIER acción sensible: cortesías, mermas de inventario,
 * cortes de caja, modificaciones de usuario, etc.
 *
 * @param gymId   - ID del gimnasio (Multitenancy estricto)
 * @param userId  - ID del usuario que ejecuta la acción
 * @param action  - Clave descriptiva del evento (ej. "COURTESY_ACCESS")
 * @param details - Payload opcional en JSON para contexto adicional
 */
export const logAuditEvent = async (
  gymId: string,
  userId: string,
  action: string,
  details?: Record<string, unknown>
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        gym_id: gymId,
        user_id: userId,
        action,
        details: (details as any) || null,
      },
    });
  } catch (error) {
    // El logger nunca debe detener el flujo principal de la app.
    console.error(`[AuditLogger] Failed to write audit log — Action: ${action}`, error);
  }
};
