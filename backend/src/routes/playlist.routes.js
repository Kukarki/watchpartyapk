import { Router } from 'express';
import {
  listPlaylists,
  createPlaylist,
  getPlaylist,
  getSharedPlaylist,
  updatePlaylist,
  deletePlaylist,
  addTrack,
  removeTrack,
  importToRoom,
} from '../controllers/playlist.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/',                                     listPlaylists);
router.post('/',                                     createPlaylist);
router.get('/shared/:shareCode',                     getSharedPlaylist);
router.get('/:playlistId',                           getPlaylist);
router.patch('/:playlistId',                         updatePlaylist);
router.delete('/:playlistId',                        deletePlaylist);
router.post('/:playlistId/tracks',                   addTrack);
router.delete('/:playlistId/tracks/:trackId',        removeTrack);
router.post('/:playlistId/import-to-room/:roomId',   importToRoom);

export default router;
