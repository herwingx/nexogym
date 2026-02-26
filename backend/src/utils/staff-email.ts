import crypto from 'crypto';

const STAFF_EMAIL_DOMAIN = 'internal.nexogym.com';

/**
 * Normaliza el nombre del gym a un slug válido para el email staff.
 * - Minúsculas
 * - Quita acentos (NFKD + remove combining marks)
 * - Espacios y caracteres especiales → guión
 * - Colapsa guiones múltiples
 * - Recorta guiones al inicio/final
 * - Fallback si queda vacío: "gym"
 */
export function normalizeGymSlug(gymName: string | null | undefined): string {
  if (!gymName || typeof gymName !== 'string') return 'gym';

  let slug = gymName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove combining marks (accents)
    .toLowerCase()
    .trim();

  // Caracteres no alfanuméricos → guión
  slug = slug.replace(/[^a-z0-9]+/g, '-');

  // Colapsar guiones múltiples y recortar
  slug = slug.replace(/-+/g, '-').replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : 'gym';
}

/**
 * Genera un email único para staff basado en el slug del gym.
 * Formato: {gym-slug}-staff-{shortId}@internal.nexogym.com
 */
export function generateStaffEmail(gymSlug: string): string {
  const shortId = crypto.randomBytes(4).toString('hex');
  const local = `${gymSlug}-staff-${shortId}`;
  return `${local}@${STAFF_EMAIL_DOMAIN}`;
}
