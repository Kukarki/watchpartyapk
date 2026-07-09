import { Router } from 'express';
import { createRoom, getRoom, getChatHistory, getPublicRooms, getRecentRooms } from '../controllers/room.controller.js';
import { authenticate } from '../middleware/auth.js';
import queueRoutes from './queue.routes.js';
import pollRoutes  from './poll.routes.js';

const router = Router();

router.use(authenticate);

router.get('/',           getPublicRooms);
router.post('/',          createRoom);
router.get('/recent',     getRecentRooms);
router.get('/:roomId',    getRoom);
router.get('/:roomId/chat', getChatHistory);

// Sub-routers — :roomId is forwarded via mergeParams
router.use('/:roomId/queue', queueRoutes);
router.use('/:roomId/polls', pollRoutes);

export default router;