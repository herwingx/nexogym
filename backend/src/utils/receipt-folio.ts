import { prisma } from '../db';

const PAD = 6; // V-2025-000001

type Db = Pick<typeof prisma, '$queryRaw'>;

/**
 * Año actual según el servidor (no el cliente). Para folios consistentes en cualquier timezone.
 */
function currentYear(): number {
  return new Date().getFullYear();
}

/**
 * Obtiene el siguiente folio de venta para el gym en el año actual.
 * Formato: V-YYYY-NNNNNN. YYYY = año del servidor. Atómico (upsert + increment).
 * Pasar `db` desde dentro de una transacción para que folio y venta queden en la misma transacción.
 */
export async function getNextSaleFolio(gymId: string, db: Db = prisma): Promise<string> {
  const year = currentYear();
  const result = await db.$queryRaw<[{ sale_seq: number; year: number }]>`
    INSERT INTO "ReceiptSequence" (gym_id, year, sale_seq, renewal_seq, updated_at)
    VALUES (${gymId}::uuid, ${year}, 1, 0, now())
    ON CONFLICT (gym_id, year)
    DO UPDATE SET sale_seq = "ReceiptSequence".sale_seq + 1, updated_at = now()
    RETURNING sale_seq, year
  `;
  const row = result[0];
  const seq = row?.sale_seq ?? 1;
  return `V-${year}-${String(seq).padStart(PAD, '0')}`;
}

/**
 * Obtiene el siguiente folio de renovación para el gym en el año actual.
 * Formato: R-YYYY-NNNNNN. YYYY = año del servidor. Atómico.
 */
export async function getNextRenewalFolio(gymId: string, db: Db = prisma): Promise<string> {
  const year = currentYear();
  const result = await db.$queryRaw<[{ renewal_seq: number; year: number }]>`
    INSERT INTO "ReceiptSequence" (gym_id, year, sale_seq, renewal_seq, updated_at)
    VALUES (${gymId}::uuid, ${year}, 0, 1, now())
    ON CONFLICT (gym_id, year)
    DO UPDATE SET renewal_seq = "ReceiptSequence".renewal_seq + 1, updated_at = now()
    RETURNING renewal_seq, year
  `;
  const row = result[0];
  const seq = row?.renewal_seq ?? 1;
  return `R-${year}-${String(seq).padStart(PAD, '0')}`;
}
