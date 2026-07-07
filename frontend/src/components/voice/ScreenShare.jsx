import { useState, useRef, useEffect, useCallback } from 'react';
import { useSocketContext } from '@/contexts/SocketContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import toast from 'react-hot-toast';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function ScreenShare({ roomId }) {
  const { socket, emit } = useSocketContext();
  const { user }         = useAuth();

  const [isSharing,   setIsSharing]  = useState(false);
  const [remoteStream, setRemote]    = useState(null);
  const [sharedBy,    setSharedBy]   = useState(null);

  const localStreamRef  = useRef(null);
  const peersRef        = useRef({});
  const remoteVideoRef  = useRef(null);
  const localVideoRef   = useRef(null);

  // Show sharer's own preview
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && isSharing) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [isSharing]);

  // Show remote stream for viewers
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // ── Peer factories ────────────────────────────────────────────────────────

  // Used by sharer when responding to a viewer's offer
  function createShareePeer(viewerId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current[viewerId] = pc;

    // Add screen tracks so we can send them to this viewer
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) =>
        pc.addTrack(t, localStreamRef.current)
      );
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) emit('screenshare:ice_candidate', { targetId: viewerId, candidate });
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        pc.close();
        delete peersRef.current[viewerId];
      }
    };

    return pc;
  }

  // Used by viewer when they want to receive the sharer's stream
  function createViewerPeer(sharerId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current[sharerId] = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) emit('screenshare:ice_candidate', { targetId: sharerId, candidate });
    };

    pc.ontrack = (event) => {
      setRemote(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        pc.close();
        delete peersRef.current[sharerId];
        setRemote(null);
        setSharedBy(null);
      }
    };

    return pc;
  }

  // ── Socket listeners ──────────────────────────────────────────────────────

  useEffect(() => {
    const s = socket.current;
    if (!s) return;

    // Someone started sharing → viewer sends them an offer
    const onStarted = ({ userId: uid, displayName }) => {
      if (uid === user?.userId) return;
      setSharedBy({ userId: uid, displayName });
      toast(`${displayName} is sharing their screen`, { icon: '🖥️' });

      const pc = createViewerPeer(uid);
      // Declare we want to RECEIVE video — this creates the required m= section in SDP
      pc.addTransceiver('video', { direction: 'recvonly' });

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => emit('screenshare:offer', { targetId: uid, sdp: pc.localDescription }))
        .catch((e) => console.error('[ScreenShare] offer failed', e));
    };

    const onStopped = ({ userId: uid }) => {
      if (uid === user?.userId) return;
      const pc = peersRef.current[uid];
      if (pc) { pc.close(); delete peersRef.current[uid]; }
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      setRemote(null);
      setSharedBy(null);
    };

    // Sharer receives a viewer's offer → answers with their screen stream
    const onOffer = async ({ fromId, sdp }) => {
      const pc = createShareePeer(fromId);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emit('screenshare:answer', { targetId: fromId, sdp: pc.localDescription });
    };

    // Viewer receives sharer's answer
    const onAnswer = async ({ fromId, sdp }) => {
      const pc = peersRef.current[fromId];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    };

    const onIce = async ({ fromId, candidate }) => {
      const pc = peersRef.current[fromId];
      if (pc && candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
    };

    s.on('screenshare:started',       onStarted);
    s.on('screenshare:stopped',       onStopped);
    s.on('screenshare:offer',         onOffer);
    s.on('screenshare:answer',        onAnswer);
    s.on('screenshare:ice_candidate', onIce);

    return () => {
      s.off('screenshare:started',       onStarted);
      s.off('screenshare:stopped',       onStopped);
      s.off('screenshare:offer',         onOffer);
      s.off('screenshare:answer',        onAnswer);
      s.off('screenshare:ice_candidate', onIce);
    };
  }, [socket.current, user?.userId]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const startShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });
      localStreamRef.current = stream;
      setIsSharing(true);
      emit('screenshare:start', { roomId });
      // Stop when user clicks browser's native "Stop sharing"
      stream.getVideoTracks()[0].onended = stopShare;
      toast.success('Screen sharing started');
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        toast.error('Could not start screen share');
      }
    }
  };

  const stopShare = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    setIsSharing(false);
    emit('screenshare:stop', { roomId });
    toast('Screen sharing stopped', { icon: '🖥️' });
  }, [emit, roomId]);

  useEffect(() => () => { if (localStreamRef.current) stopShare(); }, [stopShare]);

  // ── Video remote control (requires WatchParty extension) ─────────────────
  // Posts a message that website-bridge.js intercepts and relays to the
  // extension service worker, which executes the command on the streaming tab.
  const sendVideoControl = (action, value) => {
    window.postMessage({ type: 'WATCHPARTY_VIDEO_CONTROL', action, value }, '*');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Share button — hidden if someone else is already sharing */}
      {!sharedBy && (
        <div className="absolute bottom-16 right-4 z-20">
          <button
            onClick={isSharing ? stopShare : startShare}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium
                         border transition-all duration-200 shadow-cinema backdrop-blur-md
                         ${isSharing
                           ? 'bg-danger/20 border-danger/40 text-danger hover:bg-danger/30'
                           : 'bg-surface/90 border-border text-sub hover:border-amber/30 hover:text-bright'
                         }`}
          >
            <span>{isSharing ? '⏹' : '🖥️'}</span>
            <span>{isSharing ? 'Stop Share' : 'Share Screen'}</span>
          </button>
        </div>
      )}

      {/* Sharer's own local preview */}
      {isSharing && (
        <div className="absolute inset-0 z-10 bg-black flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-surface/90 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-online text-xs font-mono animate-pulse">🖥️ SHARING</span>
              <span className="text-sub text-xs">You are sharing your screen</span>
            </div>
            <button
              onClick={stopShare}
              className="px-3 py-1 rounded-lg text-xs bg-danger/20 border border-danger/40 text-danger hover:bg-danger/30"
            >
              Stop Share
            </button>
          </div>

          {/* Video preview */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="flex-1 w-full object-contain bg-black"
          />

          {/* Remote video controls — requires the WatchParty extension */}
          <div className="shrink-0 flex items-center justify-center gap-3 px-4 py-3
                           bg-surface/90 border-t border-border">
            <span className="text-dim text-[10px] mr-1">Video controls</span>

            <CtrlBtn title="Rewind 10s"   onClick={() => sendVideoControl('seek', -10)}>⏪ 10s</CtrlBtn>
            <CtrlBtn title="Play"         onClick={() => sendVideoControl('play')}>▶ Play</CtrlBtn>
            <CtrlBtn title="Pause"        onClick={() => sendVideoControl('pause')}>⏸ Pause</CtrlBtn>
            <CtrlBtn title="Forward 10s"  onClick={() => sendVideoControl('seek', +10)}>10s ⏩</CtrlBtn>
            <CtrlBtn title="Toggle subtitles" onClick={() => sendVideoControl('subtitles')}>CC</CtrlBtn>
          </div>
        </div>
      )}

      {/* Viewer: remote screen */}
      {remoteStream && sharedBy && !isSharing && (
        <div className="absolute inset-0 z-10 bg-black flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface/90 border-b border-border shrink-0">
            <span className="text-online text-xs font-mono animate-pulse">🖥️ LIVE</span>
            <span className="text-sub text-xs">{sharedBy.displayName} is sharing their screen</span>
          </div>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="flex-1 w-full object-contain bg-black"
          />
        </div>
      )}
    </>
  );
}

// ── Small control button ──────────────────────────────────────────────────────
function CtrlBtn({ onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="px-3 py-1.5 rounded-lg text-xs font-medium
                 bg-raised border border-border text-sub
                 hover:border-amber/40 hover:text-bright
                 active:scale-95 transition-all"
    >
      {children}
    </button>
  );
}
