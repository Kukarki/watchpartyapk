import Avatar from '@/components/ui/Avatar.jsx';

export default function VoiceMember({ member, isSelf }) {
  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border
        transition-colors duration-150
        ${member.isMuted
          ? 'bg-raised border-border opacity-60'
          : 'bg-online/5 border-online/20'
        }`}
      title={`${member.displayName}${member.isMuted ? ' (muted)' : ''}`}
    >
      <div className="relative">
        <Avatar src={member.avatar} name={member.displayName} size="xs" />
        {member.isMuted && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5
                           bg-danger rounded-full flex items-center justify-center text-[7px]">
            🔇
          </div>
        )}
      </div>
      <span className="text-xs text-sub max-w-[80px] truncate">
        {member.displayName}
        {isSelf && <span className="text-dim"> (you)</span>}
      </span>
    </div>
  );
}