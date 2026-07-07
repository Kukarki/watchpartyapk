import { Router } from 'express';
import {
  getQueue,
  addToQueue,
  voteQueueItem,
  removeQueueItem,
  playNext,
} from '../controllers/queue.controller.js';

const router = Router({ mergeParams: true }); // inherit :roomId from parent

router.get('/',                 getQueue);
router.post('/',                addToQueue);
router.post('/play-next',       playNext);
router.post('/:itemId/vote',    voteQueueItem);
router.delete('/:itemId',       removeQueueItem);

export default router;
