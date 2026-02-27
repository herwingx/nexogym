/**
 * Servicio de correo transaccional vía Brevo (getbrevo.com).
 * Reemplaza n8n para envío de emails; n8n sigue usándose solo para WhatsApp.
 *
 * Configurar BREVO_API_KEY, BREVO_FROM_EMAIL en .env.
 * Supabase Auth usa SMTP de Brevo por separado (GOTRUE_SMTP_*).
 */

import { BrevoClient } from '@getbrevo/brevo';
import { logger } from '../lib/logger';
import { prisma } from '../db';
import { env } from '../config/env';

const apiKey = env.BREVO_API_KEY?.trim() ?? '';
const fromEmail = env.BREVO_FROM_EMAIL?.trim() || 'noreply@nexogym.com';
const fromName = env.BREVO_FROM_NAME?.trim() || 'NexoGym';

const isEnabled = () => apiKey.length > 0;

function getClient(): BrevoClient | null {
  if (!isEnabled()) return null;
  return new BrevoClient({ apiKey });
}

type N8nEventKey =
  | 'admin_welcome'
  | 'staff_password_reset'
  | 'member_welcome'
  | 'member_receipt'
  | 'sale_receipt';

async function isEventEnabledForGym(gymId: string, event: N8nEventKey): Promise<boolean> {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { n8n_config: true },
  });
  const config = (gym?.n8n_config as { enabled_events?: string[] } | null) ?? {};
  const enabledEvents = config.enabled_events;
  if (!Array.isArray(enabledEvents) || enabledEvents.length === 0) return true;
  return enabledEvents.includes(event);
}

function htmlWrapper(body: string, title: string, gymName: string | null): string {
  const header = gymName ? `${gymName}` : 'NexoGym';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px"><div style="margin-bottom:24px;font-weight:600;color:#2563eb">${header}</div><div>${body}</div><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"><p style="font-size:12px;color:#6b7280">Este es un correo automático. No responder.</p></body></html>`;
}

async function sendEmail(to: string, subject: string, html: string, toName?: string | null): Promise<boolean> {
  const client = getClient();
  if (!client) {
    logger.debug('[email] Skipped (BREVO_API_KEY not configured)');
    return false;
  }
  try {
    await client.transactionalEmails.sendTransacEmail({
      subject,
      htmlContent: html,
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to, name: toName ?? undefined }],
    });
    return true;
  } catch (err) {
    logger.error({ err, to }, '[email] Brevo send failed');
    return false;
  }
}

/** Bienvenida al admin del gym (credenciales + link de login). */
export async function sendAdminWelcomeEmail(
  gymId: string,
  adminEmail: string,
  adminName: string | null,
  tempPassword: string,
  loginUrl: string,
): Promise<void> {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { name: true },
  });
  const gymName = gym?.name ?? null;
  const body = `
    <p>Hola${adminName ? ` ${adminName}` : ''},</p>
    <p>Tu gimnasio <strong>${gymName ?? 'NexoGym'}</strong> está listo. Estas son tus credenciales de acceso:</p>
    <ul>
      <li><strong>Usuario:</strong> ${adminEmail}</li>
      <li><strong>Contraseña temporal:</strong> ${tempPassword}</li>
    </ul>
    <p>En el primer inicio de sesión se te pedirá cambiar la contraseña.</p>
    <p><a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Acceder al panel</a></p>
  `;
  const ok = await sendEmail(adminEmail, 'Bienvenido a NexoGym – Credenciales de acceso', htmlWrapper(body, 'Bienvenido', gymName), adminName);
  if (ok) logger.debug({ gymId, adminEmail }, '[email] Admin welcome sent');
}

/** Nueva contraseña del staff al correo del admin (para que se la entregue al staff). */
export async function sendStaffPasswordResetToAdmin(
  adminEmail: string,
  staffName: string | null,
  staffEmail: string,
  newPassword: string,
  gymName: string | null,
): Promise<void> {
  const body = `
    <p>Se reseteó la contraseña del personal:</p>
    <ul>
      <li><strong>Usuario (email):</strong> ${staffEmail}</li>
      <li><strong>Nombre:</strong> ${staffName ?? '—'}</li>
      <li><strong>Nueva contraseña:</strong> ${newPassword}</li>
    </ul>
    <p>Entrégale estas credenciales al staff en persona. Deberá cambiarla en el primer acceso.</p>
  `;
  const ok = await sendEmail(adminEmail, 'NexoGym – Nueva contraseña para personal', htmlWrapper(body, 'Reset contraseña', gymName));
  if (ok) logger.debug({ adminEmail, staffEmail }, '[email] Staff password reset sent');
}

/** Credenciales de portal y QR al socio (bienvenida). */
export async function sendMemberWelcomeEmail(
  gymId: string,
  memberEmail: string,
  memberName: string | null,
  tempPassword: string,
  loginUrl: string,
  qrData: string,
  pin: string,
): Promise<void> {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { name: true },
  });
  const gymName = gym?.name ?? null;
  const body = `
    <p>Hola${memberName ? ` ${memberName}` : ''},</p>
    <p>Bienvenido a <strong>${gymName ?? 'tu gimnasio'}</strong>.</p>
    <p>Tu acceso al portal:</p>
    <ul>
      <li><strong>Usuario:</strong> ${memberEmail}</li>
      <li><strong>Contraseña temporal:</strong> ${tempPassword}</li>
      <li><strong>PIN:</strong> ${pin}</li>
    </ul>
    <p>Debes cambiar la contraseña en el primer inicio de sesión.</p>
    <p><a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Acceder al portal</a></p>
    <p style="margin-top:24px">Tu código QR de acceso: <code style="background:#f3f4f6;padding:4px 8px;border-radius:4px">${qrData}</code></p>
  `;
  const ok = await sendEmail(memberEmail, 'Bienvenido – Acceso al portal', htmlWrapper(body, 'Bienvenido', gymName), memberName);
  if (ok) logger.debug({ gymId, memberEmail }, '[email] Member welcome sent');
}

/** Comprobante de renovación al socio. */
export async function sendMemberReceiptEmail(
  gymId: string,
  memberEmail: string,
  payload: {
    receipt_folio: string;
    member_name: string | null;
    plan_barcode: string;
    plan_label?: string;
    amount: number;
    expires_at: string;
    renewed_at: string;
    is_visit_one_day?: boolean;
  },
): Promise<void> {
  const enabled = await isEventEnabledForGym(gymId, 'member_receipt');
  if (!enabled) {
    logger.info({ gymId, memberEmail }, '[email] Member receipt skipped by gym config');
    return;
  }
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { name: true },
  });
  const gymName = gym?.name ?? null;
  const planLabel = payload.plan_label ?? payload.plan_barcode;
  const body = `
    <p>Hola${payload.member_name ? ` ${payload.member_name}` : ''},</p>
    <p>Comprobante de renovación en <strong>${gymName ?? 'NexoGym'}</strong>:</p>
    <ul>
      <li><strong>Plan:</strong> ${planLabel}</li>
      <li><strong>Monto:</strong> $${payload.amount.toFixed(2)}</li>
      <li><strong>Vigencia hasta:</strong> ${payload.expires_at}</li>
      <li><strong>Renovado:</strong> ${payload.renewed_at}</li>
      <li><strong>Folio:</strong> ${payload.receipt_folio}</li>
    </ul>
  `;
  const ok = await sendEmail(
    memberEmail,
    `Comprobante ${payload.receipt_folio} – ${gymName ?? 'NexoGym'}`,
    htmlWrapper(body, 'Comprobante', gymName),
    payload.member_name,
  );
  if (ok) logger.debug({ gymId, memberEmail }, '[email] Member receipt sent');
}

/** Comprobante de venta POS al cliente. */
export async function sendSaleReceiptEmail(
  gymId: string,
  customerEmail: string,
  payload: {
    receipt_folio: string;
    sale_id: string;
    items: Array<{ product_name: string; quantity: number; unit_price: number; line_total: number }>;
    total: number;
    sold_at: string;
    gym_name: string | null;
  },
): Promise<void> {
  const enabled = await isEventEnabledForGym(gymId, 'sale_receipt');
  if (!enabled) {
    logger.info({ gymId, customerEmail }, '[email] Sale receipt skipped by gym config');
    return;
  }
  const gymName = payload.gym_name ?? null;
  const itemsHtml = payload.items
    .map(
      (i) =>
        `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>$${i.unit_price.toFixed(2)}</td><td>$${i.line_total.toFixed(2)}</td></tr>`,
    )
    .join('');
  const body = `
    <p>Comprobante de compra en <strong>${gymName ?? 'NexoGym'}</strong>:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead><tr style="background:#f3f4f6"><th style="text-align:left;padding:8px">Producto</th><th style="padding:8px">Cant</th><th style="padding:8px">P. unit.</th><th style="padding:8px">Total</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <p><strong>Total: $${payload.total.toFixed(2)}</strong></p>
    <p>Folio: ${payload.receipt_folio} · Fecha: ${payload.sold_at}</p>
  `;
  const ok = await sendEmail(
    customerEmail,
    `Comprobante ${payload.receipt_folio} – ${gymName ?? 'NexoGym'}`,
    htmlWrapper(body, 'Comprobante de venta', gymName),
  );
  if (ok) logger.debug({ gymId, customerEmail, receipt_folio: payload.receipt_folio }, '[email] Sale receipt sent');
}
