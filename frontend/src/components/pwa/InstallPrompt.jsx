import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const DISMISS_KEY = 'watchparty.installDismissed';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}

/**
 * A dismissible "install this app" banner.
 * - Android / desktop Chromium: uses the native beforeinstallprompt flow.
 * - iOS Safari (no such event): shows Add-to-Home-Screen instructions.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const { pathname } = useLocation();

  // Don't cover the chat composer inside any kind of room.
  const suppressed = pathname.startsWith('/room/')
    || pathname.startsWith('/music-room/')
    || pathname.startsWith('/game-room/');

  useEffect(() => {
    if (isStandalone()) return;                       // already installed
    if (localStorage.getItem(DISMISS_KEY)) return;    // user dismissed before

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const onInstalled = () => setVisible(false);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt — show manual instructions instead.
    if (isIOS()) {
      setIosHint(true);
      setVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible || suppressed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      setDeferred(null);
      setVisible(false);
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md
                    animate-slide-up"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="card flex items-center gap-3 p-3 shadow-2xl shadow-black/40
                      border-amber/25 bg-surface/95 backdrop-blur-xl">
        <img src="/icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-bright text-sm font-medium leading-tight">Install WatchParty</p>
          {iosHint ? (
            <p className="text-dim text-xs mt-0.5 leading-snug">
              Tap <span className="text-sub">Share</span> <span aria-hidden>⎋</span>, then{' '}
              <span className="text-sub">“Add to Home Screen”</span>.
            </p>
          ) : (
            <p className="text-dim text-xs mt-0.5 leading-snug">
              Add it to your home screen for an app-like experience.
            </p>
          )}
        </div>
        {!iosHint && (
          <button onClick={install} className="btn-primary text-sm shrink-0 px-4 py-2">
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          className="shrink-0 w-8 h-8 rounded-lg text-dim hover:text-bright hover:bg-raised
                     flex items-center justify-center"
          aria-label="Dismiss install prompt"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
