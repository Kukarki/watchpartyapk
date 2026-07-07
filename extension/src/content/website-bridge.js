/**
 * website-bridge.js
 * Injected by the extension onto the WatchParty website (localhost:5173).
 *
 * Purpose: the website can't call chrome.runtime.sendMessage() directly,
 * so this script listens for window.postMessage events from the page
 * and forwards them to the extension background service worker.
 *
 * Also flags the page so React can detect the extension is installed.
 */

import { sendMessage } from '../utils/extension-api.js';

// Flag the page immediately so PlatformPage.jsx's synchronous check works
window.__WATCHPARTY_EXTENSION__ = true;

// Listen for messages from the WatchParty React app
window.addEventListener('message', (event) => {
  // Only handle messages from the same page (not iframes or other origins)
  if (event.source !== window) return;
  const { type, ...rest } = event.data || {};
  if (!type?.startsWith('WATCHPARTY_')) return;

  switch (type) {

    // ── Website pinging to check if extension is installed ──
    case 'WATCHPARTY_PING':
      window.postMessage({ type: 'WATCHPARTY_EXTENSION_PRESENT' }, '*');
      break;

    // ── User clicked a platform card + created a room ───────
    // PlatformPage sends: { type, roomId, platformId, platformUrl }
    case 'WATCHPARTY_LAUNCH':
      sendMessage({
        type: 'LAUNCH_PLATFORM',
        payload: {
          roomId:      rest.roomId,
          platformId:  rest.platformId,
          platformUrl: rest.platformUrl,
          token:       rest.token,
          user:        rest.user,
          serverUrl:   rest.serverUrl,
        },
      })
        .then((response) => {
          // Tell the page the launch succeeded
          window.postMessage({ type: 'WATCHPARTY_LAUNCH_OK', ...response }, '*');
        })
        .catch((err) => console.warn('[WatchParty] Bridge error:', err.message));
      break;

    // ── Website asking extension to open its popup ──────────
    case 'WATCHPARTY_OPEN_POPUP':
      sendMessage({ type: 'OPEN_POPUP' })
        .catch((err) => console.warn('[WatchParty] Bridge error:', err.message));
      break;

    // ── Screen share video controls ─────────────────────────
    // ScreenShare.jsx sends these so the host can control the
    // streaming tab (e.g. kisskh.co) without switching tabs.
    // action: 'play' | 'pause' | 'seek' | 'subtitles'
    // value:  number (seconds offset for seek)
    case 'WATCHPARTY_VIDEO_CONTROL':
      sendMessage({
        type: 'VIDEO_CONTROL',
        payload: { action: rest.action, value: rest.value },
      })
        .catch((err) => console.warn('[WatchParty] Video control error:', err.message));
      break;
  }
});

console.log('[WatchParty] Extension bridge active ✓');