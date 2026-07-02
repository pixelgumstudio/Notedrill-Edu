import { Router } from 'express';
import { handleWebhook } from '../controllers/webhook.controller';

const router = Router();

// Note: the raw-body parser for signature verification is applied where this
// router is mounted in server.ts, not here — it must run before express.json().
router.post('/', handleWebhook);

export default router;
