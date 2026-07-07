/**
 * streaming-detector.js
 * Injected on ALL streaming platform pages.
 * Runs before content-main.js so the page can detect
 * the extension is present immediately on load.
 *
 * Also listens for WATCHPARTY_PING from any embedded
 * iframe or page scripts.
 */

import { getManifest } from '../utils/extension-api.js';

// Immediately flag this page as having the extension
window.__WATCHPARTY_EXTENSION__ = true;
window.__WATCHPARTY_VERSION__ = getManifest().version || '0.0.0';

// Respond to pings from iframes or injected scripts
window.addEventListener('message', (event) => {
  if (event.data?.type === 'WATCHPARTY_PING') {
    event.source?.postMessage({ type: 'WATCHPARTY_EXTENSION_PRESENT' }, '*');
  }
});