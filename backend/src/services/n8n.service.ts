import { logger } from '../lib/logger';
import { prisma } from '../db';

import { env } from '../config/env';

const N8N_BASE_URL = env.N8N_BASE_URL;
const DEFAULT_N8N_WEBHOOKS = {
  welcome: `${N8N_BASE_URL}/webhook/nuevo-cliente`,
  reward: `${N8N_BASE_URL}/webhook/recompensa`,
  shift_summary: `${N8N_BASE_URL}/webhook/corte-caja`,
  admin_welcome: `${N8N_BASE_URL}/webhook/admin-bienvenida`,
  staff_password_reset: `${N8N_BASE_URL}/webhook/staff-password-reset`,
  member_welcome: `${N8N_BASE_URL}/webhook/member-bienvenida`,
} as const;

export type N8nEventKey = keyof typeof DEFAULT_N8N_WEBHOOKS;

type N8nGymConfig = {
  enabled_events?: N8nEventKey[];
  provider?: string;
  sender_phone_id?: string;
  template_welcome?: string;
  template_reward?: string;
  template_shift_summary?: string;
  webhook_overrides?: Partial<Record<N8nEventKey, string>>;
};

const parseGymN8nConfig = (value: unknown): N8nGymConfig => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as N8nGymConfig;
};

const resolveN8nContext = async (gymId: string, event: N8nEventKey) => {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, name: true, n8n_config: true },
  });

  const config = parseGymN8nConfig(gym?.n8n_config);
  const enabledEvents = config.enabled_events;

  if (Array.isArray(enabledEvents) && enabledEvents.length > 0 && !enabledEvents.includes(event)) {
    return {
      enabled: false,
      webhookUrl: '',
      gymName: gym?.name ?? null,
      config,
    };
  }

  const override = config.webhook_overrides?.[event];

  return {
    enabled: true,
    webhookUrl: override || DEFAULT_N8N_WEBHOOKS[event],
    gymName: gym?.name ?? null,
    config,
  };
};

const postEvent = async (webhookUrl: string, payload: Record<string, unknown>) => {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response;
};

export const sendWelcomeMessage = async (gymId: string, phone: string, pin: string, qrPayload: string) => {
  try {
    const context = await resolveN8nContext(gymId, 'welcome');
    if (!context.enabled) {
      logger.info({ gymId, phone }, '[n8n] Welcome event skipped by gym configuration');
      return;
    }

    const response = await postEvent(context.webhookUrl, {
      event: 'welcome',
      gym_id: gymId,
      gym_name: context.gymName,
      phone,
      pin,
      qrData: qrPayload,
      messaging: {
        provider: context.config.provider || 'default',
        sender_phone_id: context.config.sender_phone_id || null,
        template: context.config.template_welcome || null,
      },
    });

    if (!response.ok) {
      logger.warn({ gymId, phone, status: response.status }, '[n8n] Failed to trigger welcome webhook');
      return;
    }

    logger.debug({ gymId, phone }, '[n8n] Welcome message queued successfully');
  } catch (error) {
    logger.error({ err: error, gymId, phone }, '[n8n] Welcome webhook trigger error');
  }
};

/** Reenvía el QR de acceso del socio por WhatsApp (mismo código estable). Para "borré el chat" o "recibir de nuevo". Usa el mismo webhook welcome con event: resend_qr. */
export const sendQrResend = async (gymId: string, phone: string, qrPayload: string) => {
  try {
    const context = await resolveN8nContext(gymId, 'welcome');
    if (!context.enabled) {
      logger.info({ gymId, phone }, '[n8n] Resend QR skipped (welcome webhook disabled)');
      return;
    }

    const response = await postEvent(context.webhookUrl, {
      event: 'resend_qr',
      gym_id: gymId,
      gym_name: context.gymName,
      phone,
      qrData: qrPayload,
      messaging: {
        provider: context.config.provider || 'default',
        sender_phone_id: context.config.sender_phone_id || null,
        template: context.config.template_welcome || null,
      },
    });

    if (!response.ok) {
      logger.warn({ gymId, phone, status: response.status }, '[n8n] Failed to trigger resend QR webhook');
      return;
    }

    logger.debug({ gymId, phone }, '[n8n] Resend QR queued successfully');
  } catch (error) {
    logger.error({ err: error, gymId, phone }, '[n8n] Resend QR webhook error');
  }
};

export const sendShiftSummary = async (gymId: string, ownerPhone: string, summary: {
  openedAt: Date;
  closedAt: Date;
  openingBalance: number;
  totalSales: number;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
}) => {
  try {
    const context = await resolveN8nContext(gymId, 'shift_summary');
    if (!context.enabled) {
      logger.info({ gymId, ownerPhone }, '[n8n] Shift summary event skipped by gym configuration');
      return;
    }

    const response = await postEvent(context.webhookUrl, {
      event: 'shift_summary',
      gym_id: gymId,
      gym_name: context.gymName,
      phone: ownerPhone,
      ...summary,
      messaging: {
        provider: context.config.provider || 'default',
        sender_phone_id: context.config.sender_phone_id || null,
        template: context.config.template_shift_summary || null,
      },
    });

    if (!response.ok) {
      logger.warn({ gymId, ownerPhone, status: response.status }, '[n8n] Failed to trigger shift summary webhook');
    } else {
      logger.debug({ gymId, ownerPhone }, '[n8n] Shift summary queued successfully');
    }
  } catch (error) {
    logger.error({ err: error, gymId, ownerPhone }, '[n8n] Shift summary webhook trigger error');
  }
};

export const sendRewardMessage = async (
  gymId: string,
  phone: string,
  rewardName: string,
  streak: number,
  accessMethod: 'MANUAL' | 'QR' | 'BIOMETRIC' = 'MANUAL',
) => {
  try {
    const context = await resolveN8nContext(gymId, 'reward');
    if (!context.enabled) {
      logger.info({ gymId, phone, streak }, '[n8n] Reward event skipped by gym configuration');
      return;
    }

    const response = await postEvent(context.webhookUrl, {
      event: 'reward',
      gym_id: gymId,
      gym_name: context.gymName,
      phone,
      rewardName,
      streak,
      access_method: accessMethod,
      messaging: {
        provider: context.config.provider || 'default',
        sender_phone_id: context.config.sender_phone_id || null,
        template: context.config.template_reward || null,
      },
    });

    if (!response.ok) {
      logger.warn({ gymId, phone, status: response.status }, '[n8n] Failed to trigger reward webhook');
    } else {
      logger.debug({ gymId, phone }, '[n8n] Reward notification queued successfully');
    }
  } catch (error) {
    logger.error({ err: error, gymId, phone, streak }, '[n8n] Reward webhook trigger error');
  }
};

/** Bienvenida al admin del gym por email (credenciales + link de login). n8n envía email, no WhatsApp. */
export const sendAdminWelcomeEmail = async (
  gymId: string,
  adminEmail: string,
  adminName: string | null,
  tempPassword: string,
  loginUrl: string,
) => {
  try {
    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { name: true, n8n_config: true },
    });
    const config = parseGymN8nConfig(gym?.n8n_config);
    const override = config.webhook_overrides?.['admin_welcome' as N8nEventKey];
    const webhookUrl = override || DEFAULT_N8N_WEBHOOKS.admin_welcome;

    const response = await postEvent(webhookUrl, {
      event: 'admin_welcome',
      gym_id: gymId,
      gym_name: gym?.name ?? null,
      admin_email: adminEmail,
      admin_name: adminName ?? null,
      temp_password: tempPassword,
      login_url: loginUrl,
    });

    if (!response.ok) {
      logger.warn({ gymId, adminEmail, status: response.status }, '[n8n] Admin welcome email webhook failed');
      return;
    }
    logger.debug({ gymId, adminEmail }, '[n8n] Admin welcome email queued');
  } catch (error) {
    logger.error({ err: error, gymId, adminEmail }, '[n8n] Admin welcome webhook error');
  }
};

/** Envía la nueva contraseña del staff al correo del admin (para que se la entregue al staff). n8n envía email. */
export const sendStaffPasswordResetToAdmin = async (
  adminEmail: string,
  staffName: string | null,
  staffEmail: string,
  newPassword: string,
  gymName: string | null,
) => {
  try {
    const webhookUrl = DEFAULT_N8N_WEBHOOKS.staff_password_reset;

    const response = await postEvent(webhookUrl, {
      event: 'staff_password_reset',
      admin_email: adminEmail,
      staff_name: staffName ?? null,
      staff_email: staffEmail,
      new_password: newPassword,
      gym_name: gymName ?? null,
    });

    if (!response.ok) {
      logger.warn({ adminEmail, staffEmail, status: response.status }, '[n8n] Staff password reset webhook failed');
      return;
    }
    logger.debug({ adminEmail, staffEmail }, '[n8n] Staff password reset email queued');
  } catch (error) {
    logger.error({ err: error, adminEmail, staffEmail }, '[n8n] Staff password reset webhook error');
  }
};

/** Envía credenciales de portal (gamificación) y QR como backup al socio por email. Para socios con email en el alta. */
export const sendMemberWelcomeEmail = async (
  gymId: string,
  memberEmail: string,
  memberName: string | null,
  tempPassword: string,
  loginUrl: string,
  qrData: string,
  pin: string,
) => {
  try {
    const webhookUrl = DEFAULT_N8N_WEBHOOKS.member_welcome;

    const response = await postEvent(webhookUrl, {
      event: 'member_welcome',
      gym_id: gymId,
      member_email: memberEmail,
      member_name: memberName ?? null,
      temp_password: tempPassword,
      login_url: loginUrl,
      qr_data: qrData,
      pin,
    });

    if (!response.ok) {
      logger.warn({ gymId, memberEmail, status: response.status }, '[n8n] Member welcome email webhook failed');
      return;
    }
    logger.debug({ gymId, memberEmail }, '[n8n] Member welcome email queued');
  } catch (error) {
    logger.error({ err: error, gymId, memberEmail }, '[n8n] Member welcome webhook error');
  }
};
