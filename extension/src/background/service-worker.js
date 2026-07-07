/**
 * Background Service Worker
 * Handles:
 *   - Auth token management
 *   - Room state persistence
 *   - Badge updates
 *   - Website → extension bridge (via website-bridge.js content script)
 *   - Platform launch (open Prime/Netflix tab after room created)
 */

import { getRuntime, getTabsApi, getActionApi, getURL, getManifest, queryTabs, storageGet, storageSet, storageRemove } from '../utils/extension-api.js';

const runtime = getRuntime();
const tabs = getTabsApi();
const action = getActionApi();
const DEFAULT_SERVER = 'http://localhost:4000';

// ── Lifecycle ─────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ── All messages (internal + from website-bridge.js) ──────
runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // keep channel open for async responses
});

// ── Message router ────────────────────────────────────────
function handleMessage(message, sender, sendResponse) {
  const { type, payload } = message;

  switch (type) {

    // ── State ──────────────────────────────────────────────
    case 'GET_STATE':
      getState().then(sendResponse);
      break;

    // ── Auth (set by popup after guest login) ──────────────
    case 'SET_AUTH':
      storageSet({ token: payload.token, user: payload.user })
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      break;

    // ── Join room (popup join tab) ─────────────────────────
    case 'JOIN_ROOM':
      storageSet({
        roomId:    payload.roomId,
        serverUrl: payload.serverUrl || DEFAULT_SERVER,
      })
        .then(() => {
          updateBadge(true, payload.roomId);
          sendResponse({ ok: true });
        })
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      break;

    // ── LAUNCH_PLATFORM ────────────────────────────────────
    // Called by website-bridge.js when user clicks
    // "Open Prime Video & Start Watching" on PlatformPage.
    // 1. Save roomId so content-main.js picks it up
    // 2. Open the streaming platform in a new tab
    case 'LAUNCH_PLATFORM':
      storageSet({
        roomId:          payload.roomId,
        serverUrl:       payload.serverUrl || DEFAULT_SERVER,
        pendingPlatform: payload.platformId,
        ...(payload.token && { token: payload.token }),
        ...(payload.user  && { user:  payload.user  }),
      })
        .then(async () => {
          updateBadge(true, payload.roomId);
          try {
            const tab = await tabs.create({
              url:    payload.platformUrl,
              active: true,
            });
            sendResponse({ ok: true, tabId: tab.id });
          } catch (err) {
            sendResponse({ ok: false, error: err.message });
          }
        })
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      break;

    // ── Leave room ─────────────────────────────────────────
    case 'LEAVE_ROOM':
      storageRemove(['roomId', 'pendingPlatform'])
        .then(() => {
          updateBadge(false);
          sendResponse({ ok: true });
        })
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      break;

    // ── Full logout ────────────────────────────────────────
    case 'CLEAR_AUTH':
      storageRemove(['token', 'user', 'roomId', 'pendingPlatform'])
        .then(() => {
          updateBadge(false);
          sendResponse({ ok: true });
        })
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      break;

    // ── Which platform is the active tab? (for popup UI) ───
    case 'GET_ACTIVE_TAB_PLATFORM':
      getActiveTabPlatform().then(sendResponse);
      break;

    // ── Website pinging to verify extension installed ───────
    // (Handled by website-bridge.js postMessage, but also
    //  useful as a direct chrome.runtime call from devtools)
    case 'EXTENSION_PING':
      sendResponse({
        ok:      true,
        version: getManifest().version,
      });
      break;

    // ── Open popup as tab (fallback — MV3 can't force popup) ─
    case 'OPEN_POPUP':
      tabs.create({
        url: getURL('src/popup/popup.html'),
      });
      sendResponse({ ok: true });
      break;

    // ── Video control from ScreenShare overlay ─────────────
    // Find the streaming tab (kisskh, YouTube, etc.) and
    // execute the requested action on its video element.
    case 'VIDEO_CONTROL':
      handleVideoControl(payload).then(sendResponse);
      break;

    default:
      sendResponse({ ok: false, error: `Unknown type: ${type}` });
  }
}

// ── Video control execution ───────────────────────────────

const STREAMING_PATTERNS = [
  'kisskh.co', 'kisskh.me',
  'primevideo.com', 'amazon.com/gp/video',
  'netflix.com', 'disneyplus.com',
  'hbomax.com', 'max.com',
  'youtube.com', 'tv.apple.com',
];

async function handleVideoControl({ action, value }) {
  try {
    // Find the first open streaming tab
    const allTabs = await tabs.query({});
    const streamingTab = allTabs.find((t) =>
      t.url && STREAMING_PATTERNS.some((p) => t.url.includes(p))
    );

    if (!streamingTab) return { ok: false, error: 'No streaming tab found' };

    // Build the JS to execute on that tab
    const fn = buildControlFn(action, value);
    if (!fn) return { ok: false, error: `Unknown action: ${action}` };

    await chrome.scripting.executeScript({
      target: { tabId: streamingTab.id },
      func:   fn,
      args:   [value ?? 0],
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function buildControlFn(action) {
  switch (action) {
    case 'play':
      return () => { const v = document.querySelector('video'); v?.play(); };
    case 'pause':
      return () => { const v = document.querySelector('video'); v?.pause(); };
    case 'seek':
      return (secs) => {
        const v = document.querySelector('video');
        if (v) v.currentTime = Math.max(0, v.currentTime + secs);
      };
    case 'subtitles':
      return () => {
        // Try clicking platform subtitle button first
        const ccBtn =
          document.querySelector('[title*="ubtitle"]') ||
          document.querySelector('[aria-label*="ubtitle"]') ||
          document.querySelector('.vjs-subtitles-button') ||
          document.querySelector('.plyr__control[data-plyr="captions"]');
        if (ccBtn) { ccBtn.click(); return; }
        // Fallback: toggle first text track
        const v = document.querySelector('video');
        if (!v) return;
        const track = Array.from(v.textTracks || [])[0];
        if (track) track.mode = track.mode === 'showing' ? 'disabled' : 'showing';
      };
    default:
      return null;
  }
}

// ── Helpers ───────────────────────────────────────────────

async function getState() {
  const data = await storageGet(['token', 'user', 'roomId', 'serverUrl', 'pendingPlatform']);
  return {
    isAuthenticated: !!data.token,
    user:            data.user            || null,
    roomId:          data.roomId          || null,
    serverUrl:       data.serverUrl       || DEFAULT_SERVER,
    pendingPlatform: data.pendingPlatform || null,
  };
}

function updateBadge(inRoom, roomId) {
  action?.setBadgeText({ text: inRoom ? 'LIVE' : '' });
  action?.setBadgeBackgroundColor({
    color: inRoom ? '#f5a623' : '#666666',
  });
  action?.setTitle({
    title: inRoom && roomId
      ? `WatchParty — Room ${roomId}`
      : 'WatchParty',
  });
}

async function getActiveTabPlatform() {
  const tabsList = await queryTabs({ active: true, currentWindow: true });
  const url = tabsList[0]?.url || '';
  let platform = null;
  if (url.includes('primevideo.com') || url.includes('amazon.com/gp/video'))
    platform = 'Prime Video';
  else if (url.includes('netflix.com/watch'))
    platform = 'Netflix';
  else if (url.includes('disneyplus.com'))
    platform = 'Disney+';
  else if (url.includes('hbomax.com') || url.includes('max.com'))
    platform = 'Max';
  else if (url.includes('youtube.com/watch'))
    platform = 'YouTube';
  else if (url.includes('tv.apple.com'))
    platform = 'Apple TV+';
  return { platform, url };
}