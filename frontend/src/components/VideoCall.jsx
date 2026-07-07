import { useState, useRef, useEffect, useCallback } from 'react';
import { useWebRTC }          from '@/hooks/useWebRTC.js';
import { useCallRinger }      from '@/hooks/useCallRinger.js';
import { useBackgroundBlur }  from '@/hooks/useBackgroundBlur.js';
import { useRoomStore }       from '@/store/roomStore.js';
import { useAuthStore }       from '@/store/authStore.js';
import { useSocketContext }   from '@/contexts/SocketContext.jsx';
import PeerVideo              from '@/components/PeerVideo.jsx';
import CallControls           from '@/components/CallControls.jsx';
import CallReactions          from '@/components/CallReactions.jsx';
import toast                  from 'react-hot-toast';

// ── Detect mobile viewport ────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)');
    const fn  = (e) => setMobile(e.matches);
    mql.addEventListener('change', fn);
    return () => mql.removeEventListener('change', fn);
  }, []);
  return mobile;
}

/**
 * VideoCall
 * Floating, draggable video call panel (desktop) or fixed top strip (mobile).
 * Supports up to 4 participants with background blur, emoji reactions,
 * and a synthesised ring tone when someone starts a call.
 */
export default function VideoCall() {
  const { room, members } = useRoomStore();
  const { user }          = useAuthStore();
  const { socket }        = useSocketContext();
  const isMobile          = useIsMobile();

  const {
    localStream,
    remoteStreams,
    isMuted,
    isCameraOff,
    isInCall,
    callError,
    startCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    updateVideoTrack,
  } = useWebRTC();

  const {
    isEnabled:  isBlurOn,
    isLoading:  isBlurLoading,
    blurError,
    toggle:     toggleBlur,
    processedStream,
  } = useBackgroundBlur();

  // Ring whenever someone else starts a call while we're not in it
  useCallRinger(isInCall);

  const [isMinimized, setIsMinimized] = useState(false);
  const [position,    setPosition]    = useState({ x: 16, y: 16 });
  const [dragging,    setDragging]    = useState(false);
  const [incomingName, setIncomingName] = useState(null); // for the ring banner
  const dragStart = useRef(null);

  // ── Surface errors ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (callError)  toast.error(callError,  { id: 'call-error' });
  }, [callError]);

  useEffect(() => {
    if (blurError) toast.error(blurError, { id: 'blur-error' });
  }, [blurError]);

  // ── Incoming call banner ────────────────────────────────────────────────────

  useEffect(() => {
    const s = socket.current;
    if (!s) return;
    const onJoined = ({ displayName }) => {
      if (!isInCall) setIncomingName(displayName);
    };
    const onLeft = () => setIncomingName(null);
    s.on('call:member_joined', onJoined);
    s.on('call:member_left',   onLeft);
    return () => {
      s.off('call:member_joined', onJoined);
      s.off('call:member_left',   onLeft);
    };
  }, [socket, isInCall]);

  useEffect(() => {
    if (isInCall) setIncomingName(null);
  }, [isInCall]);

  // ── Join / leave ────────────────────────────────────────────────────────────

  const handleJoin = async () => {
    const roomId = room?.id;
    if (!roomId) return;
    await startCall(roomId);
  };

  const handleLeave = useCallback(() => {
    if (isBlurOn) toggleBlur(localStream, updateVideoTrack);
    leaveCall();
    setIsMinimized(false);
    setIncomingName(null);
  }, [leaveCall, isBlurOn, toggleBlur, localStream, updateVideoTrack]);

  useEffect(() => {
    return () => { if (isInCall) leaveCall(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drag (mouse) ────────────────────────────────────────────────────────────

  const onMouseDown = (e) => {
    if (isMobile || e.target.closest('button')) return;
    setDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => setPosition({
      x: Math.max(0, e.clientX - dragStart.current.x),
      y: Math.max(0, e.clientY - dragStart.current.y),
    });
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup',   up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup',   up);
    };
  }, [dragging]);

  // ── Drag (touch) ────────────────────────────────────────────────────────────

  const onTouchStart = (e) => {
    if (isMobile || e.target.closest('button')) return;
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { x: t.clientX - position.x, y: t.clientY - position.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const t = e.touches[0];
      setPosition({
        x: Math.max(0, t.clientX - dragStart.current.x),
        y: Math.max(0, t.clientY - dragStart.current.y),
      });
    };
    const end = () => setDragging(false);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend',  end);
    return () => {
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend',  end);
    };
  }, [dragging]);

  // ── Participants ────────────────────────────────────────────────────────────

  const remoteEntries  = Object.entries(remoteStreams);
  const totalCount     = 1 + remoteEntries.length;

  const remoteTiles = remoteEntries.map(([uid, stream]) => {
    const m = members.find((x) => x.userId === uid) ?? {};
    return { userId: uid, stream, displayName: m.displayName ?? 'Participant', avatar: m.avatar };
  });

  // The stream shown in the local tile: blurred canvas stream or raw camera
  const localDisplayStream = isBlurOn && processedStream ? processedStream : localStream;

  const gridCols = totalCount === 1 ? 'grid-cols-1' : 'grid-cols-2';

  // ── Positioning ─────────────────────────────────────────────────────────────

  const panelStyle = isMobile
    ? { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }
    : {
        position: 'absolute',
        left:   position.x,
        top:    position.y,
        width:  isMinimized ? 'auto' : 360,
        zIndex: 20,
      };

  // ── Incoming call banner (not in call) ──────────────────────────────────────

  if (!isInCall) {
    return (
      <>
        {/* Join button */}
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={handleJoin}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                         bg-surface/90 backdrop-blur-md border border-border
                         hover:border-info/40 hover:bg-info/5
                         text-sub hover:text-info text-sm font-medium
                         transition-all duration-200 shadow-cinema"
          >
            <span className="text-base">🎥</span>
            <span>Join Video Call</span>
            {remoteEntries.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-info/20 text-info text-xs font-mono">
                {remoteEntries.length}
              </span>
            )}
          </button>
        </div>

        {/* Incoming ring banner */}
        {incomingName && (
          <div className="absolute top-16 left-4 z-20 animate-slide-up">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl
                              bg-surface/95 backdrop-blur-xl border border-info/30
                              shadow-cinema animate-ring-pulse">
              <span className="text-2xl animate-ring-pulse">📞</span>
              <div>
                <p className="text-bright text-sm font-medium">{incomingName} is calling…</p>
                <p className="text-dim text-xs font-mono mt-0.5">Click Join to answer</p>
              </div>
              <button
                onClick={handleJoin}
                className="ml-2 px-3 py-1.5 rounded-lg bg-online/20 border border-online/30
                             text-online text-xs font-medium hover:bg-online/30
                             transition-colors active:scale-95"
              >
                Answer
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Floating call panel (in call) ───────────────────────────────────────────

  return (
    <div
      style={panelStyle}
      className={`select-none ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''}`}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <div className="bg-surface/95 backdrop-blur-xl border border-border
                       rounded-2xl shadow-cinema overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2
                         border-b border-border bg-void/40">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-info animate-pulse" />
            <span className="text-xs font-mono text-sub uppercase tracking-widest">
              Video Call
            </span>
            <span className="text-xs text-dim font-mono">· {totalCount}</span>
            {isBlurOn && (
              <span className="text-[10px] font-mono text-info bg-info/10
                                px-1.5 py-0.5 rounded border border-info/20">
                blur on
              </span>
            )}
          </div>
        </div>

        {/* Video grid + reaction overlay */}
        {!isMinimized && (
          <div className="relative p-1.5">
            <div className={`grid ${gridCols} gap-1.5`}>

              {/* Local tile */}
              <div className="aspect-video">
                <PeerVideo
                  stream={localDisplayStream}
                  displayName={user?.displayName ?? 'You'}
                  avatar={user?.avatar}
                  isMuted={isMuted}
                  isCameraOff={isCameraOff}
                  isLocal
                />
              </div>

              {/* Remote tiles */}
              {remoteTiles.map(({ userId, stream, displayName, avatar }) => (
                <div key={userId} className="aspect-video">
                  <PeerVideo
                    stream={stream}
                    displayName={displayName}
                    avatar={avatar}
                  />
                </div>
              ))}

              {/* Ghost slot — keeps 2×2 shape when exactly 3 people */}
              {totalCount === 3 && (
                <div className="aspect-video rounded-xl border border-dashed border-border/30
                                   bg-raised/20 flex items-center justify-center">
                  <span className="text-dim/30 text-xs font-mono">· · ·</span>
                </div>
              )}
            </div>

            {/* Floating reaction emojis + picker */}
            <CallReactions />
          </div>
        )}

        {/* Controls */}
        <div className="px-3 py-2.5 border-t border-border bg-void/30
                         flex items-center justify-center">
          <CallControls
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            isBlurOn={isBlurOn}
            isBlurLoading={isBlurLoading}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onToggleBlur={null}
            onLeave={handleLeave}
            onToggleMinimize={() => setIsMinimized((v) => !v)}
            isMinimized={isMinimized}
          />
        </div>

      </div>
    </div>
  );
}
