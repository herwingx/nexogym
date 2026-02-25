import { prisma } from '../db';

const PURGE_RETENTION_DAYS = 60;

/**
 * Purga (hard delete) gimnasios en status CANCELLED cuyo deleted_at
 * sea mayor a PURGE_RETENTION_DAYS en el pasado.
 * Ejecutar desde un cron (ej. diario).
 */
export async function purgeCancelledGyms(): Promise<{ purged: number; ids: string[] }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PURGE_RETENTION_DAYS);

  const toPurge = await prisma.gym.findMany({
    where: {
      status: 'CANCELLED',
      deleted_at: { lt: cutoff },
    },
    select: { id: true },
  });

  const ids = toPurge.map((g) => g.id);
  for (const gym of toPurge) {
    await prisma.gym.delete({ where: { id: gym.id } });
  }

  return { purged: ids.length, ids };
}
