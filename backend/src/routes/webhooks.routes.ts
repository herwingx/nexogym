import { Router } from 'express';
import { billingWebhook } from '../controllers/webhooks.controller';

const router = Router();

router.post('/billing', billingWebhook);

export default router;
