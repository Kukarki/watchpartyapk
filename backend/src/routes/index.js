import { Router } from 'express';
import authRoutes     from './auth.routes.js';
import roomRoutes     from './room.routes.js';
import proxyRoutes    from './proxy.routes.js';
import friendRoutes   from './friend.routes.js';
import playlistRoutes from './playlist.routes.js';
import historyRoutes  from './history.routes.js';
import spotifyRoutes  from './spotify.routes.js';
import youtubeRoutes  from './youtube.routes.js';

const router = Router();

// Auth — guest login, email register/login, OAuth callback, profile
router.use('/auth', authRoutes);

// Rooms — room CRUD, chat, queue, polls
router.use('/rooms', roomRoutes);

// Friends — requests, list, presence-aware list, search
router.use('/friends', friendRoutes);

// Playlists — durable, shareable track lists (independent of any room)
router.use('/playlists', playlistRoutes);

// Listen history — tracks played in music rooms
router.use('/history', historyRoutes);

// Spotify — OAuth connect + now-playing (read-only, no playback control)
router.use('/spotify', spotifyRoutes);

// YouTube — OAuth connect + list/import the user's own playlists
router.use('/youtube', youtubeRoutes);

// HLS proxy — strips CORS restrictions from kisskh CDN streams
router.use('/proxy', proxyRoutes);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

export default router;