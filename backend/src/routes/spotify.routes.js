import { Router } from 'express';
import { getAuthUrl, handleCallback, getNowPlaying, disconnect } from '../controllers/spotify.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/auth-url',      getAuthUrl);
router.post('/callback',     handleCallback);
router.get('/now-playing',   getNowPlaying);
router.delete('/connection', disconnect);

export default router;
