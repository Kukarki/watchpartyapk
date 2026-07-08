import { Router } from 'express';
import {
  sendRequest,
  respondRequest,
  listFriends,
  listRequests,
  removeFriend,
  searchUsers,
} from '../controllers/friend.controller.js';
import { authenticate } from '../middleware/auth.js';
import { friendLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.use(authenticate);

router.post('/request',  friendLimiter, sendRequest);
router.post('/respond',  respondRequest);
router.get('/',           listFriends);
router.get('/requests',   listRequests);
router.delete('/:friendId', removeFriend);
router.post('/search',    friendLimiter, searchUsers);

export default router;
