import { Router } from 'express';
import authRoutes     from './auth.routes.js';
import roomRoutes     from './room.routes.js';
import proxyRoutes    from './proxy.routes.js';
import friendRoutes   from './friend.routes.js';
import playlistRoutes from './playlist.routes.js';
import historyRoutes  from './history.routes.js';
import spotifyRoutes  from './spotify.routes.js';
import youtubeRoutes  from './youtube.routes.js';
import vroidHubRoutes from './vroidHub.routes.js';
import webrtcRoutes   from './webrtc.routes.js';

const router = Router();

// Avatar system (catalog/shop/inventory/progression/gifts) is mounted
// directly in server.js instead, since it needs the Socket.io `io` instance
// (only available after HTTP server creation) to broadcast equip/unequip
// updates — mounting it here too previously double-mounted it at the same
// path, bypassing the rate limiter on one of the two copies.

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

// VRoid Hub — OAuth connect + pick one of the user's own VRM models as their avatar
router.use('/vroid-hub', vroidHubRoutes);

// HLS proxy — strips CORS restrictions from kisskh CDN streams
router.use('/proxy', proxyRoutes);

// WebRTC — time-limited TURN/STUN credentials for calls and screen share
router.use('/webrtc', webrtcRoutes);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

export default router;