import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { validateSignature, validateTimestamp } from '../middleware/security';
import {
  getConfig,
  postSpin,
  getAdminSummary,
  getMyPrizes,
  postWinnerWebhook,
} from '../controllers/spin.controller';

const router = Router();

router.get('/config', requireAuth, getConfig);
router.get('/my-prizes', requireAuth, getMyPrizes);
router.post('/', requireAuth, validateTimestamp, validateSignature, postSpin);
router.get('/admin/summary', requireAuth, requireAdmin, getAdminSummary);
router.post('/webhook/winner', postWinnerWebhook);

export default router;
