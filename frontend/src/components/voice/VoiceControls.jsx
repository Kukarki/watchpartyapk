import Avatar from '@/components/ui/Avatar.jsx';

export default function VoiceControls({ isMuted, isDeafened, isSpeaking, onToggleMute, onToggleDeafen, onLeave, user }) {
  const btn = `w-8 h-8 flex items-center justify-center rounded-lg text-sm
               transition-all duration-150 active:scale-90 border`;
  const neutral = 'bg-raised border-border text-sub hover:text-bright hover:border-amber/30';
  const active  = 'bg-danger/20 border-danger/40 text-danger hover:bg-danger/30';

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Avatar
          src={user?.avatar}
          name={user?.displayName}
          size="xs"
          className={isSpeaking ? 'ring-2 ring-online' : ''}
        />
        <div>
          <p className="text-xs text-bright leading-tight">{user?.displayName}</p>
          <p className={`text-[10px] font-mono ${
            isDeafened ? 'text-danger' : isMuted ? 'text-danger' : isSpeaking ? 'text-online' : 'text-dim'
          }`}>
            {isDeafened ? 'Deafened' : isMuted ? 'Muted' : isSpeaking ? 'Speaking' : 'Connected'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleMute}
          className={`${btn} ${isMuted ? active : neutral}`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🎙️'}
        </button>
        <button
          onClick={onToggleDeafen}
          className={`${btn} ${isDeafened ? active : neutral}`}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
        >
          {isDeafened ? '🔕' : '🎧'}
        </button>
        <button
          onClick={onLeave}
          className={`${btn} ${active}`}
          title="Leave voice"
        >
          📵
        </button>
      </div>
    </div>
  );
}
