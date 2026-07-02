import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { createCheckout } from '../controllers/billing.controller';

const router = Router();

// Mounted at /api/v1/org/billing in server.ts — full path: POST /api/v1/org/billing/checkout
router.post('/checkout', authenticate, requireRole('org_admin', 'superadmin'), createCheckout);

export default router;
