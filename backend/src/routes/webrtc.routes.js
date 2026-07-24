import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getIceServers } from '../controllers/webrtc.controller.js';

const router = Router();

router.use(authenticate);

router.get('/ice-servers', getIceServers);

export default router;
