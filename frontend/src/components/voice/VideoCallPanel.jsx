import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoomStore } from '@/store/roomStore.js';
import { useRoomActions } from '@/contexts/RoomContext.jsx';
import { useVoice } from '@/hooks/useVoice.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Avatar from '@/components/ui/Avatar.jsx';
import toast from 'react-hot-toast';

export default function VideoCallPanel() {
  const { voiceMembers, members, localVoiceState } = useRoomStore();
  const { joinVoice, leaveVoice, toggleMute } = useRoomActions();
  const { startLocalAudio, stopLocalAudio, destroyAllPeers } = useVoice();
  const { user } = useAuth();

  const [isOpen, setIsOpen]         = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition]     = useState({ x: 16, y: 16 });
  const [dragging, setDragging]     = useState(false);
  const dragStart = useRef(null);
  const panelRef  = useRef(null);

  const channelId      = 'general';
  const voiceList      = voiceMembers[channelId] || [];
  const isInCall       = localVoiceState.channelId === channelId;
  const isMuted        = localVoiceState.isMuted;
  const callDuration   = useCallTimer(isInCall);

  // ── Join ────────────────────────────────────────────────
  const handleJoin = async () => {
    try {
      await startLocalAudio();
      joinVoice(channelId);
      setIsOpen(true);
      setIsMinimized(false);
    } catch (err) {
      toast.error(err.name === 'NotAllowedError' ? 'Microphone access denied' : 'Could not start voice call');
    }
  };

  // ── Leave ───────────────────────────────────────────────
  const handleLeave = useCallback(() => {
    leaveVoice();
    stopLocalAudio();
    destroyAllPeers();
    setIsOpen(false);
  }, [leaveVoice, stopLocalAudio, destroyAllPeers]);

  // Cleanup on unmount — read fresh store state to avoid stale closure
  useEffect(() => {
    return () => {
      const { localVoiceState } = useRoomStore.getState();
      if (localVoiceState.channelId) handleLeave();
    };
  }, [handleLeave]);

  // ── Drag ────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.target.closest('button')) return;
    setDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => setPosition({
      x: Math.max(0, e.clientX - dragStart.current.x),
      y: Math.max(0, e.clientY - dragStart.current.y),
    });
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  // Enrich voice list with full member info
  const voiceParticipants = voiceList.map((vm) => {
    const full = members.find((m) => m.userId === vm.userId);
    return { ...vm, avatar: full?.avatar || vm.avatar, displayName: full?.displayName || vm.displayName };
  });

  // ── Collapsed join button ───────────────────────────────
  if (!isOpen && !isInCall) {
    return (
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={handleJoin}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl
                     bg-black/60 backdrop-blur-xl border border-white/10
                     hover:bg-white/10 text-white/80 hover:text-white
                     text-sm font-medium transition-all duration-200 shadow-xl"
        >
          <span className="text-base">📞</span>
          <span>Start Call</span>
          {voiceList.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-mono">
              {voiceList.length} in call
            </span>
          )}
        </button>
      </div>
    );
  }

  // ── Minimized pip ───────────────────────────────────────
  if (isMinimized) {
    return (
      <div
        ref={panelRef}
        className="absolute z-30 select-none"
        style={{ left: position.x, top: position.y, cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
      >
        <div className="flex items-center gap-2 px-3 py-2 rounded-full
                        bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/70 text-xs font-mono">{callDuration}</span>
          <div className="flex -space-x-2">
            {voiceParticipants.slice(0, 3).map((p) => (
              <div key={p.userId} className="relative">
                <Avatar src={p.avatar} name={p.displayName} size="xs" />
                {!p.isMuted && (
                  <div className="absolute inset-0 rounded-full border border-green-400 animate-pulse" />
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setIsMinimized(false)}
            className="text-white/50 hover:text-white text-xs px-1 transition-colors"
            title="Expand"
          >
            ⬆
          </button>
          <button
            onClick={handleLeave}
            className="w-6 h-6 flex items-center justify-center rounded-full
                       bg-red-500 hover:bg-red-400 text-white text-xs transition-colors"
            title="End call"
          >
            📵
          </button>
        </div>
      </div>
    );
  }

  // ── Full Messenger-style panel ──────────────────────────
  return (
    <div
      ref={panelRef}
      className="absolute z-30 select-none"
      style={{ left: position.x, top: position.y, cursor: dragging ? 'grabbing' : 'grab', width: 260 }}
      onMouseDown={onMouseDown}
    >
      <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/10"
           style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>

        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/80 text-xs font-semibold tracking-wide">Voice Call</span>
            <span className="text-white/40 text-xs font-mono">{callDuration}</span>
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            className="w-6 h-6 flex items-center justify-center rounded-full
                       bg-white/10 hover:bg-white/20 text-white/60 hover:text-white
                       text-xs transition-colors"
            title="Minimize"
          >
            ⬇
          </button>
        </div>

        {/* Participant tiles */}
        <div className="p-4">
          {voiceParticipants.length === 0 ? (
            <div className="text-center py-6">
              {/* Your own avatar while waiting */}
              <div className="relative inline-block mb-3">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-green-400/50
                                ring-4 ring-green-400/20 mx-auto">
                  <Avatar src={user?.avatar} name={user?.displayName} size="xl" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-green-400
                                animate-ping opacity-30" />
              </div>
              <p className="text-white/90 text-sm font-medium">{user?.displayName}</p>
              <p className="text-white/40 text-xs mt-1">Waiting for others to join…</p>
            </div>
          ) : (
            <div className={`grid gap-3 ${voiceParticipants.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {voiceParticipants.map((member) => {
                const isSelf = member.userId === user?.userId;
                const speaking = !member.isMuted;
                return (
                  <div key={member.userId} className="flex flex-col items-center gap-2">
                    {/* Avatar with speaking ring */}
                    <div className="relative">
                      <div className={`w-16 h-16 rounded-full overflow-hidden border-2 transition-colors duration-300
                                       ${speaking ? 'border-green-400' : 'border-white/20'}`}>
                        <Avatar src={member.avatar} name={member.displayName} size="xl" />
                      </div>
                      {/* Outer pulsing ring when speaking */}
                      {speaking && (
                        <div className="absolute -inset-1 rounded-full border-2 border-green-400/50 animate-pulse" />
                      )}
                      {/* Mute badge */}
                      {member.isMuted && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 flex items-center
                                        justify-center rounded-full bg-red-500 border-2 border-[#1a1a2e]
                                        text-[10px]">
                          🔇
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-white/90 text-xs font-medium leading-tight truncate max-w-[90px]">
                        {isSelf ? 'You' : member.displayName}
                      </p>
                      <p className={`text-[10px] font-mono mt-0.5 ${speaking ? 'text-green-400' : 'text-red-400'}`}>
                        {speaking ? '● speaking' : '● muted'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Control bar — Messenger style */}
        <div className="flex items-center justify-center gap-4 px-4 pb-5 pt-2">
          {/* Mute button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={toggleMute}
              className={`w-12 h-12 flex items-center justify-center rounded-full text-lg
                          transition-all duration-200 active:scale-90
                          ${isMuted
                            ? 'bg-white/20 text-white border-2 border-white/30'
                            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white border-2 border-transparent'
                          }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎙️'}
            </button>
            <span className="text-white/40 text-[10px]">{isMuted ? 'Unmute' : 'Mute'}</span>
          </div>

          {/* End call — prominent red, center */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleLeave}
              className="w-14 h-14 flex items-center justify-center rounded-full text-xl
                         bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/40
                         transition-all duration-200 active:scale-90 border-2 border-red-400/30"
              title="End call"
            >
              📵
            </button>
            <span className="text-white/40 text-[10px]">End</span>
          </div>

          {/* Join voice in room (invite others hint) */}
          <div className="flex flex-col items-center gap-1">
            <button
              className="w-12 h-12 flex items-center justify-center rounded-full text-lg
                         bg-white/10 text-white/70 hover:bg-white/20 hover:text-white
                         border-2 border-transparent transition-all duration-200 active:scale-90"
              title="Participants"
              onClick={() => {}}
            >
              👥
            </button>
            <span className="text-white/40 text-[10px]">{voiceParticipants.length} in call</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Call duration timer hook ──────────────────────────────
function useCallTimer(active) {
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    if (!active) { setSeconds(0); startRef.current = null; return; }
    startRef.current = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}
