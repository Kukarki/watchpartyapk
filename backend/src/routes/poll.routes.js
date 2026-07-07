import { Router } from 'express';
import {
  getActivePoll,
  createPoll,
  votePoll,
  endPoll,
} from '../controllers/poll.controller.js';

const router = Router({ mergeParams: true }); // inherit :roomId from parent

router.get('/active',                       getActivePoll);
router.post('/',                            createPoll);
router.post('/:pollId/vote/:optionIndex',   votePoll);
router.patch('/:pollId/end',               endPoll);

export default router;
