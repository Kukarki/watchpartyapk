import { Router } from 'express';
import authRoutes  from './auth.routes.js';
import roomRoutes  from './room.routes.js';
import proxyRoutes from './proxy.routes.js';

const router = Router();

// Auth — guest login, email register/login, OAuth callback, profile
router.use('/auth', authRoutes);

// Rooms — room CRUD, chat, queue, polls
router.use('/rooms', roomRoutes);

// HLS proxy — strips CORS restrictions from kisskh CDN streams
router.use('/proxy', proxyRoutes);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

export default router;