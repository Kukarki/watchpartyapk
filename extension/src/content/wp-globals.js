/**
 * wp-globals.js
 * Classic-script (no import/export) counterpart to utils/extension-api.js,
 * for use by content scripts. manifest.json content_scripts entries can't
 * declare "type": "module", so top-level import/export isn't available
 * there — only the background service worker and popup.js can use the real
 * extension-api.js. This file must be listed first in every content_scripts
 * "js" array that needs it; it attaches everything to window.__WP__.api so
 * the scripts loaded after it (website-bridge.js, streaming-detector.js,
 * content-main.js) can read from that instead of importing.
 */
(function () {
  const ext = globalThis.browser ?? globalThis.chrome;
  const runtime = ext?.runtime || ext;
  const storage = ext?.storage;

  function getManifest() {
    return runtime?.getManifest?.() || {};
  }

  function getURL(path) {
    return runtime?.getURL?.(path) || '';
  }

  function sendMessage(typeOrMessage, payload) {
    const message = typeof typeOrMessage === 'string'
      ? { type: typeOrMessage, payload }
      : typeOrMessage;

    return new Promise((resolve, reject) => {
      if (!runtime?.sendMessage) {
        return reject(new Error('Runtime API unavailable'));
      }
      try {
        const result = runtime.sendMessage(message, (response) => {
          if (runtime?.lastError) reject(new Error(runtime.lastError.message));
          else resolve(response);
        });
        if (result?.then && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  function storageGet(keys) {
    const area = storage?.local;
    if (!area?.get) return Promise.reject(new Error('Storage API unavailable'));
    try {
      const result = area.get(keys);
      if (result?.then && typeof result.then === 'function') return result;
      return new Promise((resolve, reject) => {
        area.get(keys, (data) => {
          if (runtime?.lastError) reject(new Error(runtime.lastError.message));
          else resolve(data);
        });
      });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  window.__WP__ = window.__WP__ || {};
  window.__WP__.api = { getManifest, getURL, sendMessage, storageGet };
})();
