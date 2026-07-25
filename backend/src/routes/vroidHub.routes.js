import { Router } from 'express';
import { getAuthUrl, handleCallback, listModels, selectModel, getAvatarUrl, disconnect } from '../controllers/vroidHub.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/auth-url',      getAuthUrl);
router.post('/callback',     handleCallback);
router.get('/models',        listModels);
router.post('/select',       selectModel);
router.get('/avatar-url',    getAvatarUrl);
router.delete('/connection', disconnect);

export default router;
