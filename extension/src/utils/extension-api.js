/**
 * extension-api.js
 * Cross-browser wrapper for chrome/browser extension APIs.
 */
const ext = globalThis.browser ?? globalThis.chrome;
const runtime = ext?.runtime || ext;
const storage = ext?.storage;
const tabs = ext?.tabs;
const action = ext?.action || ext?.browserAction || ext?.pageAction;

export function getRuntime() {
  return runtime;
}

export function getStorageArea() {
  return storage?.local;
}

export function getTabsApi() {
  return tabs;
}

export function getActionApi() {
  return action;
}

export function getManifest() {
  return runtime?.getManifest?.() || {};
}

export function getRuntimeId() {
  return runtime?.id || runtime?.runtime?.id || '';
}

export function getURL(path) {
  return runtime?.getURL?.(path) || '';
}

export function sendMessage(typeOrMessage, payload) {
  const message = typeof typeOrMessage === 'string'
    ? { type: typeOrMessage, payload }
    : typeOrMessage;

  return new Promise((resolve, reject) => {
    if (!runtime?.sendMessage) {
      return reject(new Error('Runtime API unavailable'));
    }

    try {
      const result = runtime.sendMessage(message, (response) => {
        if (runtime?.lastError) {
          reject(new Error(runtime.lastError.message));
        } else {
          resolve(response);
        }
      });

      if (result?.then && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

export function onMessage(listener) {
  return runtime?.onMessage?.addListener?.(listener);
}

export function removeOnMessage(listener) {
  return runtime?.onMessage?.removeListener?.(listener);
}

export function storageGet(keys) {
  const area = getStorageArea();
  if (!area?.get) return Promise.reject(new Error('Storage API unavailable'));
  try {
    const result = area.get(keys);
    if (result?.then && typeof result.then === 'function') {
      return result;
    }
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

export function storageSet(items) {
  const area = getStorageArea();
  if (!area?.set) return Promise.reject(new Error('Storage API unavailable'));
  try {
    const result = area.set(items);
    if (result?.then && typeof result.then === 'function') {
      return result;
    }
    return new Promise((resolve, reject) => {
      area.set(items, () => {
        if (runtime?.lastError) reject(new Error(runtime.lastError.message));
        else resolve();
      });
    });
  } catch (err) {
    return Promise.reject(err);
  }
}

export function storageRemove(keys) {
  const area = getStorageArea();
  if (!area?.remove) return Promise.reject(new Error('Storage API unavailable'));
  try {
    const result = area.remove(keys);
    if (result?.then && typeof result.then === 'function') {
      return result;
    }
    return new Promise((resolve, reject) => {
      area.remove(keys, () => {
        if (runtime?.lastError) reject(new Error(runtime.lastError.message));
        else resolve();
      });
    });
  } catch (err) {
    return Promise.reject(err);
  }
}

export function queryTabs(queryInfo) {
  if (!tabs?.query) return Promise.reject(new Error('Tabs API unavailable'));
  try {
    const result = tabs.query(queryInfo);
    if (result?.then && typeof result.then === 'function') {
      return result;
    }
    return new Promise((resolve, reject) => {
      tabs.query(queryInfo, (results) => {
        if (runtime?.lastError) reject(new Error(runtime.lastError.message));
        else resolve(results);
      });
    });
  } catch (err) {
    return Promise.reject(err);
  }
}

export function createTab(createProperties) {
  if (!tabs?.create) return Promise.reject(new Error('Tabs API unavailable'));
  try {
    const result = tabs.create(createProperties);
    if (result?.then && typeof result.then === 'function') {
      return result;
    }
    return new Promise((resolve, reject) => {
      tabs.create(createProperties, (tab) => {
        if (runtime?.lastError) reject(new Error(runtime.lastError.message));
        else resolve(tab);
      });
    });
  } catch (err) {
    return Promise.reject(err);
  }
}

export function setBadgeText(details) {
  return action?.setBadgeText?.(details);
}

export function setBadgeBackgroundColor(details) {
  return action?.setBadgeBackgroundColor?.(details);
}

export function setTitle(details) {
  return action?.setTitle?.(details);
}
