import { Router } from 'express';
import { getListenHistory } from '../controllers/history.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/', getListenHistory);

export default router;
