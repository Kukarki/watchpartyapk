import { useLocation, useNavigate } from 'react-router-dom';
import { useVoiceStore } from '@/store/voiceStore.js';
import { useVoiceActions } from '@/contexts/VoiceContext.jsx';
import { useAuthStore } from '@/store/authStore.js';
import { useAudioLevel } from '@/hooks/useAudioLevel.js';
import Avatar from '@/components/ui/Avatar.jsx';

// Persistent "still connected to voice" bar — visible on every page while
// joined to a voice channel, mirroring Discord's own bottom voice status
// bar that stays up no matter which channel/page you're browsing.
export default function VoicePresenceBar() {
  const { localVoiceState } = useVoiceStore();
  const { toggleMute, toggleDeafen, leaveVoice, localStream } = useVoiceActions();
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const level = useAudioLevel(localVoiceState.channelId ? localStream : null);
  const isSpeaking = !localVoiceState.isMuted && level > 0.08;

  if (!localVoiceState.channelId) return null;

  const onOwnRoomPage = localVoiceState.roomPath && location.pathname === localVoiceState.roomPath;

  const btn = `w-8 h-8 flex items-center justify-center rounded-lg text-sm
               transition-all duration-150 active:scale-90 border`;
  const neutral = 'bg-raised border-border text-sub hover:text-bright hover:border-amber/30';
  const active  = 'bg-danger/20 border-danger/40 text-danger hover:bg-danger/30';

  return (
    <div className="fixed bottom-16 sm:bottom-0 inset-x-0 z-30 border-t border-border
                     bg-surface/95 backdrop-blur-xl px-3 py-2 shadow-cinema">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar
            src={user?.avatar}
            name={user?.displayName}
            size="xs"
            className={isSpeaking ? 'ring-2 ring-online' : ''}
          />
          <div className="min-w-0">
            <p className="text-xs text-bright leading-tight truncate">
              🔊 {localVoiceState.channelName || 'Voice'}
            </p>
            <p className="text-[10px] text-dim font-mono truncate">
              {localVoiceState.roomName || 'Connected'}
            </p>
          </div>
          {!onOwnRoomPage && localVoiceState.roomPath && (
            <button
              onClick={() => navigate(localVoiceState.roomPath)}
              className="text-amber text-xs hover:underline underline-offset-2 shrink-0"
            >
              Return to room →
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={toggleMute}
            title={localVoiceState.isMuted ? 'Unmute' : 'Mute'}
            className={`${btn} ${localVoiceState.isMuted ? active : neutral}`}
          >
            {localVoiceState.isMuted ? '🔇' : '🎙️'}
          </button>
          <button
            onClick={toggleDeafen}
            title={localVoiceState.isDeafened ? 'Undeafen' : 'Deafen'}
            className={`${btn} ${localVoiceState.isDeafened ? active : neutral}`}
          >
            {localVoiceState.isDeafened ? '🔕' : '🎧'}
          </button>
          <button
            onClick={leaveVoice}
            title="Leave voice"
            className={`${btn} ${active}`}
          >
            📵
          </button>
        </div>
      </div>
    </div>
  );
}
