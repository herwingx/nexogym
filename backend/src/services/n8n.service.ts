import { logger } from '../lib/logger';

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678';
const N8N_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/nuevo-cliente`;
const N8N_REWARD_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/recompensa`;

export const sendWelcomeMessage = async (phone: string, pin: string, qrPayload: string) => {
  try {
    logger.debug({ phone }, '[n8n] Triggering welcome message');

    // We do not await this on the main thread when we call it in the controller.
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone,
        pin,
        qrData: qrPayload,
      }),
    });

    if (!response.ok) {
      logger.warn({ phone, status: response.status }, '[n8n] Failed to trigger welcome webhook');
    } else {
      logger.debug({ phone }, '[n8n] Welcome message queued successfully');
    }

  } catch (error) {
    // Isolated catch block ensures the server doesn't crash if webhook service is down
    logger.error({ err: error, phone }, '[n8n] Welcome webhook trigger error');
  }
};

export const sendShiftSummary = async (ownerPhone: string, summary: {
  openedAt: Date;
  closedAt: Date;
  openingBalance: number;
  totalSales: number;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
}) => {
  const N8N_SHIFT_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/corte-caja`;
  try {
    logger.debug({ ownerPhone }, '[n8n] Triggering shift summary');

    const response = await fetch(N8N_SHIFT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: ownerPhone, ...summary }),
    });

    if (!response.ok) {
      logger.warn({ ownerPhone, status: response.status }, '[n8n] Failed to trigger shift summary webhook');
    } else {
      logger.debug({ ownerPhone }, '[n8n] Shift summary queued successfully');
    }
  } catch (error) {
    logger.error({ err: error, ownerPhone }, '[n8n] Shift summary webhook trigger error');
  }
};

export const sendRewardMessage = async (phone: string, rewardName: string, streak: number) => {
  try {
    logger.debug({ phone, streak }, '[n8n] Triggering reward notification');

    const response = await fetch(N8N_REWARD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, rewardName, streak }),
    });

    if (!response.ok) {
      logger.warn({ phone, status: response.status }, '[n8n] Failed to trigger reward webhook');
    } else {
      logger.debug({ phone }, '[n8n] Reward notification queued successfully');
    }
  } catch (error) {
    logger.error({ err: error, phone, streak }, '[n8n] Reward webhook trigger error');
  }
};
