import { Router } from 'express';
import { requireHardwareKey } from '../middlewares/hardware.middleware';
import { biometricCheckIn } from '../controllers/biometric.controller';

const router = Router();

// Endpoint for the physical biometric turnstile
// Hardware sends `x-api-key` header and `footprint_id` in the body
router.post('/checkin', requireHardwareKey, biometricCheckIn);

export default router;
