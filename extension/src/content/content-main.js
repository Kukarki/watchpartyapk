/**
 * content-main.js
 * Injected into streaming platform pages.
 * Responsibilities:
 *   1. Detect the platform and find the video element
 *   2. Connect to WatchParty backend via WebSocket
 *   3. Listen for video events and broadcast them
 *   4. Receive remote events and apply them to the video
 *   5. Inject the floating overlay UI
 */

import { detectAdapter } from './platform-adapters.js';
import { SocketClient } from '../utils/socket-client.js';
import { getURL, storageGet } from '../utils/extension-api.js';

// ── Constants ────────────────────────────────────────────
const SYNC_THRESHOLD_S = 2;
const SERVER_URL = 'http://localhost:4000'; // Updated by user in popup settings

// ── State ────────────────────────────────────────────────
let socket = null;
let adapter = null;
let video = null;
let roomId = null;
let user = null;
let isLocalAction = false;
let lastSeekSent = 0;
let overlayFrame = null;
let isInRoom = false;

// ── Init ─────────────────────────────────────────────────
async function init() {
  adapter = detectAdapter();
  if (!adapter) return;

  // Load auth + room state from extension storage
  const stored = await storageGet(['token', 'user', 'roomId', 'serverUrl']);
  if (!stored.token || !stored.roomId) return;

  user = stored.user;
  roomId = stored.roomId;
  const serverUrl = stored.serverUrl || SERVER_URL;

  // Wait for video element to appear (streaming sites load it lazily)
  video = await waitForVideo(adapter);
  if (!video) return;

  console.log(`[WatchParty] Detected ${adapter.name}, video found`);

  // Connect socket
  socket = new SocketClient(serverUrl);
  socket.connect(stored.token);

  socket.on('_connect', () => {
    console.log('[WatchParty] Socket connected');
    socket.send('room:join', { roomId });
    injectOverlay();
    notifyOverlay({ type: 'STATUS', status: 'connected', user, roomId });
  });

  socket.on('_disconnect', () => {
    notifyOverlay({ type: 'STATUS', status: 'disconnected' });
  });

  // ── Incoming video events ──────────────────────────────
  socket.on('room:joined', ({ members, chatHistory, videoState }) => {
    isInRoom = true;
    notifyOverlay({ type: 'ROOM_JOINED', members, chatHistory, videoState });

    // Apply current video state
    if (videoState) applyVideoState(videoState);
  });

  socket.on('room:member_joined', ({ member }) => {
    notifyOverlay({ type: 'MEMBER_JOINED', member });
  });

  socket.on('room:member_left', ({ userId, displayName }) => {
    notifyOverlay({ type: 'MEMBER_LEFT', userId, displayName });
  });

  socket.on('video:play', ({ currentTime, userId: uid }) => {
    if (uid === user?.userId) return;
    applyRemote(() => {
      syncTime(currentTime);
      video.play().catch(() => {});
    });
    notifyOverlay({ type: 'VIDEO_ACTION', action: 'play', by: uid });
  });

  socket.on('video:pause', ({ currentTime, userId: uid }) => {
    if (uid === user?.userId) return;
    applyRemote(() => {
      syncTime(currentTime);
      video.pause();
    });
    notifyOverlay({ type: 'VIDEO_ACTION', action: 'pause', by: uid });
  });

  socket.on('video:seek', ({ currentTime, userId: uid }) => {
    if (uid === user?.userId) return;
    applyRemote(() => syncTime(currentTime));
  });

  socket.on('video:state', (state) => {
    applyVideoState(state);
  });

  socket.on('chat:message', ({ message }) => {
    notifyOverlay({ type: 'CHAT_MESSAGE', message });
  });

  socket.on('chat:typing', ({ userId: uid, displayName, isTyping }) => {
    notifyOverlay({ type: 'CHAT_TYPING', userId: uid, displayName, isTyping });
  });

  socket.on('chat:reaction', ({ messageId, emoji, userId: uid }) => {
    notifyOverlay({ type: 'CHAT_REACTION', messageId, emoji, userId: uid });
    showFloatingReaction(emoji);
  });

  socket.on('voice:member_joined', (data) => {
    notifyOverlay({ type: 'VOICE_JOINED', ...data });
  });

  socket.on('voice:member_left', (data) => {
    notifyOverlay({ type: 'VOICE_LEFT', ...data });
  });

  socket.on('voice:muted', (data) => {
    notifyOverlay({ type: 'VOICE_MUTED', ...data });
  });

  socket.on('room:error', ({ code, message }) => {
    console.error('[WatchParty] Room error', code, message);
    notifyOverlay({ type: 'ERROR', code, message });
  });

  // ── Outgoing video events ──────────────────────────────
  video.addEventListener('play', onPlay);
  video.addEventListener('pause', onPause);
  video.addEventListener('seeked', onSeeked);

  // ── Messages from overlay iframe ───────────────────────
  window.addEventListener('message', onOverlayMessage);

  // ── Cleanup on page unload ─────────────────────────────
  window.addEventListener('beforeunload', cleanup);
}

// ── Video event handlers ──────────────────────────────────

function onPlay() {
  if (isLocalAction) { isLocalAction = false; return; }
  if (!isInRoom) return;
  socket.send('video:play', { roomId, currentTime: video.currentTime, timestamp: Date.now() });
}

function onPause() {
  if (isLocalAction) { isLocalAction = false; return; }
  if (!isInRoom) return;
  socket.send('video:pause', { roomId, currentTime: video.currentTime, timestamp: Date.now() });
}

function onSeeked() {
  if (isLocalAction) { isLocalAction = false; return; }
  if (!isInRoom) return;
  const now = Date.now();
  if (now - lastSeekSent < 500) return; // debounce
  lastSeekSent = now;
  socket.send('video:seek', { roomId, currentTime: video.currentTime, timestamp: now });
}

// ── Apply remote state ────────────────────────────────────

function applyRemote(fn) {
  isLocalAction = true;
  fn();
}

function syncTime(remoteTime) {
  if (Math.abs(video.currentTime - remoteTime) > SYNC_THRESHOLD_S) {
    video.currentTime = remoteTime;
  }
}

function applyVideoState({ isPlaying, currentTime, updatedAt }) {
  const elapsed = isPlaying ? (Date.now() - updatedAt) / 1000 : 0;
  const target = currentTime + elapsed;
  applyRemote(() => {
    syncTime(target);
    if (isPlaying && video.paused) video.play().catch(() => {});
    if (!isPlaying && !video.paused) video.pause();
  });
}

// ── Messages from overlay ─────────────────────────────────

function onOverlayMessage(event) {
  if (event.source !== overlayFrame?.contentWindow) return;
  const { type, payload } = event.data || {};

  switch (type) {
    case 'CHAT_SEND':
      socket.send('chat:message', { roomId, content: payload.content });
      break;
    case 'CHAT_REACT':
      socket.send('chat:reaction', { roomId, messageId: payload.messageId, emoji: payload.emoji });
      break;
    case 'CHAT_TYPING':
      socket.send('chat:typing', { roomId, isTyping: payload.isTyping });
      break;
    case 'VOICE_JOIN':
      socket.send('voice:join', { roomId, channelId: payload.channelId });
      break;
    case 'VOICE_LEAVE':
      socket.send('voice:leave', { roomId, channelId: payload.channelId });
      break;
    case 'VOICE_MUTE':
      socket.send('voice:mute', { roomId, isMuted: payload.isMuted });
      break;
    case 'VOICE_OFFER':
      socket.send('voice:offer', { targetId: payload.targetId, sdp: payload.sdp });
      break;
    case 'VOICE_ANSWER':
      socket.send('voice:answer', { targetId: payload.targetId, sdp: payload.sdp });
      break;
    case 'VOICE_ICE':
      socket.send('voice:ice_candidate', { targetId: payload.targetId, candidate: payload.candidate });
      break;
    case 'SYNC_REQUEST':
      socket.send('video:sync_request', { roomId });
      break;
    case 'LEAVE_ROOM':
      cleanup();
      break;
  }
}

// Forward socket events to overlay
socket?.on('voice:offer', (data) => notifyOverlay({ type: 'VOICE_OFFER', ...data }));
socket?.on('voice:answer', (data) => notifyOverlay({ type: 'VOICE_ANSWER', ...data }));
socket?.on('voice:ice_candidate', (data) => notifyOverlay({ type: 'VOICE_ICE', ...data }));

// ── Overlay iframe ────────────────────────────────────────

function injectOverlay() {
  if (overlayFrame) return;

  overlayFrame = document.createElement('iframe');
  overlayFrame.src = getURL('src/overlay/overlay.html');
  overlayFrame.id = 'watchparty-overlay';

  Object.assign(overlayFrame.style, {
    position:    'fixed',
    top:         '0',
    right:       '0',
    width:       '340px',
    height:      '100vh',
    border:      'none',
    zIndex:      '2147483647',
    background:  'transparent',
    pointerEvents: 'none', // overlay manages its own pointer-events internally
  });

  document.body.appendChild(overlayFrame);

  overlayFrame.onload = () => {
    notifyOverlay({
      type: 'INIT',
      platform: adapter.name,
      platformColor: adapter.logoColor,
      user,
      roomId,
    });
  };
}

function notifyOverlay(message) {
  overlayFrame?.contentWindow?.postMessage(message, '*');
}

// ── Floating emoji reaction ───────────────────────────────

function showFloatingReaction(emoji) {
  const el = document.createElement('div');
  el.textContent = emoji;
  const x = 20 + Math.random() * 60; // % from left
  Object.assign(el.style, {
    position:   'fixed',
    bottom:     '80px',
    left:       `${x}%`,
    fontSize:   '2.5rem',
    zIndex:     '2147483646',
    pointerEvents: 'none',
    transition: 'transform 2s ease-out, opacity 2s ease-out',
    transform:  'translateY(0)',
    opacity:    '1',
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transform = 'translateY(-200px)';
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 2100);
}

// ── Helpers ───────────────────────────────────────────────

function waitForVideo(adapter, timeout = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const v = adapter.getVideo();
      if (v) return resolve(v);
      if (Date.now() - start > timeout) return resolve(null);
      setTimeout(check, 500);
    };
    check();
  });
}

function getStorage(keys) {
  return storageGet(keys);
}

function cleanup() {
  video?.removeEventListener('play', onPlay);
  video?.removeEventListener('pause', onPause);
  video?.removeEventListener('seeked', onSeeked);
  window.removeEventListener('message', onOverlayMessage);
  socket?.disconnect();
  overlayFrame?.remove();
  overlayFrame = null;
  isInRoom = false;
}

// ── Start ─────────────────────────────────────────────────
init().catch(console.error);