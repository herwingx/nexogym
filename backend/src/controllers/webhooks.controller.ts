import { Request, Response } from 'express';
import { prisma } from '../db';
import { handleControllerError } from '../utils/http';
import { env } from '../config/env';

/**
 * POST /api/v1/webhooks/billing
 * Base para Cron o proveedor de billing: actualiza status del gym a SUSPENDED
 * cuando la suscripción expira o el pago falla.
 * Requiere header x-billing-secret si BILLING_WEBHOOK_SECRET está definido.
 */
export const billingWebhook = async (req: Request, res: Response) => {
  try {
    const secret = req.headers['x-billing-secret'] as string | undefined;
    if (env.BILLING_WEBHOOK_SECRET && secret !== env.BILLING_WEBHOOK_SECRET) {
      res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
      return;
    }

    const { gym_id, event } = req.body as { gym_id?: string; event?: string };
    if (!gym_id || typeof gym_id !== 'string') {
      res.status(400).json({ error: 'gym_id is required' });
      return;
    }

    const eventType = event === 'payment_failed' || event === 'subscription_expired' ? event : 'subscription_expired';

    const gym = await prisma.gym.findUnique({
      where: { id: gym_id },
      select: { id: true, status: true },
    });

    if (!gym) {
      res.status(404).json({ error: 'Gym not found' });
      return;
    }

    if (gym.status === 'ACTIVE') {
      await prisma.gym.update({
        where: { id: gym_id },
        data: { status: 'SUSPENDED' },
      });
    }

    res.status(200).json({
      ok: true,
      gym_id,
      event: eventType,
      message: gym.status === 'ACTIVE' ? 'Gym status set to SUSPENDED.' : 'Gym was already not ACTIVE.',
    });
  } catch (error) {
    handleControllerError(req, res, error, '[billingWebhook Error]', 'Billing webhook failed.');
  }
};
