import { Router } from 'express';
import { getAuthUrl, handleCallback, listPlaylists, importPlaylist, searchVideos, disconnect } from '../controllers/youtube.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/auth-url',                     getAuthUrl);
router.post('/callback',                    handleCallback);
router.get('/search',                       searchVideos);
router.get('/playlists',                    listPlaylists);
router.post('/playlists/:playlistId/import', importPlaylist);
router.delete('/connection',                disconnect);

export default router;
