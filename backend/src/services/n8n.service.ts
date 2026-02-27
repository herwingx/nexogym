import { logger } from '../lib/logger';
import { prisma } from '../db';

import { env } from '../config/env';

const N8N_BASE_URL = env.N8N_BASE_URL;
/** Webhooks n8n: solo WhatsApp (welcome, staff_welcome, reward, shift_summary). Emails van por Brevo. */
const DEFAULT_N8N_WEBHOOKS = {
  welcome: `${N8N_BASE_URL}/webhook/nuevo-cliente`,
  staff_welcome: `${N8N_BASE_URL}/webhook/staff-bienvenida`,
  reward: `${N8N_BASE_URL}/webhook/recompensa`,
  shift_summary: `${N8N_BASE_URL}/webhook/corte-caja`,
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

/** Bienvenida al staff por WhatsApp (QR de acceso). Usa webhook staff_welcome; si no hay override, usa welcome (n8n bifurca por event). */
export const sendStaffWelcomeMessage = async (
  gymId: string,
  phone: string,
  staffName: string | null,
  gymName: string | null,
  qrPayload: string,
) => {
  try {
    const context = await resolveN8nContext(gymId, 'welcome');
    if (!context.enabled) {
      logger.info({ gymId, phone }, '[n8n] Staff welcome skipped (welcome webhook disabled)');
      return;
    }

    const webhookUrl = context.webhookUrl;
    const response = await postEvent(webhookUrl, {
      event: 'staff_welcome',
      gym_id: gymId,
      gym_name: gymName ?? null,
      phone,
      staff_name: staffName ?? null,
      qrData: qrPayload,
      messaging: {
        provider: context.config.provider || 'default',
        sender_phone_id: context.config.sender_phone_id || null,
      },
    });

    if (!response.ok) {
      logger.warn({ gymId, phone, status: response.status }, '[n8n] Failed to trigger staff welcome webhook');
      return;
    }
    logger.debug({ gymId, phone }, '[n8n] Staff welcome message queued successfully');
  } catch (error) {
    logger.error({ err: error, gymId, phone }, '[n8n] Staff welcome webhook error');
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

