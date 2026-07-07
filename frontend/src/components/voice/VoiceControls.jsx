import Avatar from '@/components/ui/Avatar.jsx';

export default function VoiceControls({ isMuted, onToggleMute, user }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Avatar src={user?.avatar} name={user?.displayName} size="xs" />
        <div>
          <p className="text-xs text-bright leading-tight">{user?.displayName}</p>
          <p className={`text-[10px] font-mono ${isMuted ? 'text-danger' : 'text-online'}`}>
            {isMuted ? 'Muted' : 'Speaking'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleMute}
          className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm
                       transition-all duration-150 active:scale-90
                       ${isMuted
                         ? 'bg-danger/20 border border-danger/40 text-danger hover:bg-danger/30'
                         : 'bg-raised border border-border text-sub hover:text-bright hover:border-amber/30'
                       }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🎙️'}
        </button>
      </div>
    </div>
  );
}