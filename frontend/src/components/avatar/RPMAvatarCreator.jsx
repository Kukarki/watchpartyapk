import { useEffect, useRef, useCallback } from 'react';

// Requires a free Ready Player Me developer account + subdomain
// (readyplayer.me/studio), set as VITE_RPM_SUBDOMAIN. Without it the
// creator can't load — this component surfaces that clearly rather than
// silently failing.
const SUBDOMAIN = import.meta.env.VITE_RPM_SUBDOMAIN;

function parseRpmMessage(event) {
  if (typeof event.data !== 'string') return event.data?.source === 'readyplayerme' ? event.data : null;
  try {
    const json = JSON.parse(event.data);
    return json?.source === 'readyplayerme' ? json : null;
  } catch {
    return null;
  }
}

export default function RPMAvatarCreator({ onAvatarCreated, onClose }) {
  const iframeRef = useRef(null);

  const handleMessage = useCallback((event) => {
    const msg = parseRpmMessage(event);
    if (!msg) return;

    // RPM's frame API requires an explicit subscribe handshake once the
    // creator signals it's ready, or no further events are sent.
    if (msg.eventName === 'v1.frame.ready') {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ target: 'readyplayerme', type: 'subscribe', eventName: 'v1.**' }),
        '*'
      );
      return;
    }
    if (msg.eventName === 'v1.avatar.exported' && msg.data?.url) {
      onAvatarCreated(msg.data.url);
    }
  }, [onAvatarCreated]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  return (
    <div className="fixed inset-0 z-[9999] bg-void/90 flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl h-[80vh] rounded-2xl overflow-hidden border border-border bg-surface animate-slide-up">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-void/70 text-bright
                     flex items-center justify-center hover:bg-void transition-colors"
        >
          ✕
        </button>

        {!SUBDOMAIN ? (
          <div className="w-full h-full flex items-center justify-center p-8 text-center">
            <p className="text-sub text-sm max-w-sm">
              Ready Player Me isn't configured yet — a free developer subdomain
              (from readyplayer.me/studio) needs to be set as
              <span className="text-bright font-mono"> VITE_RPM_SUBDOMAIN</span> before
              the avatar creator can load.
            </p>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            title="Ready Player Me avatar creator"
            src={`https://${SUBDOMAIN}.readyplayer.me/avatar?frameApi&bodyType=fullbody&quickStart=false&clearCache=true`}
            className="w-full h-full border-0"
            allow="camera *; microphone *"
          />
        )}
      </div>
    </div>
  );
}
