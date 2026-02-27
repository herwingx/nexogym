import { Router } from 'express';
import { billingWebhook, streakResetWebhook } from '../controllers/webhooks.controller';

const router = Router();

router.post('/streak-reset', streakResetWebhook);
router.post('/billing', billingWebhook);

export default router;
