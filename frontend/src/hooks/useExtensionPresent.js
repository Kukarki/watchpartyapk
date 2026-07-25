import { useState, useEffect } from 'react';

// The extension's content script sets window.__WATCHPARTY_EXTENSION__ at
// document_start, but on an SPA route change (no full page reload) that only
// covers tabs that were already open when the extension was installed/
// enabled. A PING/PONG round-trip catches the extension being present even
// when the flag wasn't set in time (or the tab predates the extension being
// enabled).
export function useExtensionPresent() {
  const [extensionPresent, setExtensionPresent] = useState(!!window.__WATCHPARTY_EXTENSION__);

  useEffect(() => {
    if (extensionPresent) return;
    const onMessage = (event) => {
      if (event.source !== window) return;
      if (event.data?.type === 'WATCHPARTY_EXTENSION_PRESENT') setExtensionPresent(true);
    };
    window.addEventListener('message', onMessage);
    window.postMessage({ type: 'WATCHPARTY_PING' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, [extensionPresent]);

  return extensionPresent;
}
