const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678';
const N8N_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/nuevo-cliente`;
const N8N_REWARD_WEBHOOK_URL = `${N8N_BASE_URL}/webhook/recompensa`;

export const sendWelcomeMessage = async (phone: string, pin: string, qrPayload: string) => {
  try {
    console.log(`[n8n] Triggering welcome message for ${phone}...`);

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
      console.warn(`[n8n] Failed to trigger welcome webhook. Status: ${response.status}`);
    } else {
      console.log(`[n8n] Welcome message queued successfully for ${phone}.`);
    }

  } catch (error) {
    // Isolated catch block ensures the server doesn't crash if webhook service is down
    console.error('[n8n] Webhook trigger error:', error);
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
    console.log(`[n8n] Triggering shift summary for ${ownerPhone}...`);

    const response = await fetch(N8N_SHIFT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: ownerPhone, ...summary }),
    });

    if (!response.ok) {
      console.warn(`[n8n] Failed to trigger shift summary webhook. Status: ${response.status}`);
    } else {
      console.log(`[n8n] Shift summary queued successfully for ${ownerPhone}.`);
    }
  } catch (error) {
    console.error('[n8n] Shift summary webhook trigger error:', error);
  }
};

export const sendRewardMessage = async (phone: string, rewardName: string, streak: number) => {
  try {
    console.log(`[n8n] Triggering reward notification for ${phone} (streak: ${streak})...`);

    const response = await fetch(N8N_REWARD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, rewardName, streak }),
    });

    if (!response.ok) {
      console.warn(`[n8n] Failed to trigger reward webhook. Status: ${response.status}`);
    } else {
      console.log(`[n8n] Reward notification queued successfully for ${phone}.`);
    }
  } catch (error) {
    console.error('[n8n] Reward webhook trigger error:', error);
  }
};
