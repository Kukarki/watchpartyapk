import { useRoomStore } from '@/store/roomStore.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Avatar from '@/components/ui/Avatar.jsx';

export default function MemberList() {
  const { members, room, voiceMembers } = useRoomStore();
  const { user } = useAuth();

  const voiceUserIds = new Set(
    Object.values(voiceMembers).flatMap((ch) => ch.map((m) => m.userId))
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-mono text-dim uppercase tracking-widest">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {members.map((member) => {
          const isHost = member.isHost === true || member.userId === room?.hostId;
          const isSelf = member.userId === user?.userId;
          const inVoice = voiceUserIds.has(member.userId);

          return (
            <div
              key={member.userId}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-raised
                          transition-colors group"
            >
              <div className="relative shrink-0">
                <Avatar
                  src={member.avatar}
                  name={member.displayName}
                  size="sm"
                />
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full
                               border-2 border-surface bg-online"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-bright truncate flex items-center gap-1.5">
                  <span className="truncate">{member.displayName}</span>
                  {isSelf && <span className="text-dim text-xs shrink-0">(you)</span>}
                  {isHost && (
                    <span className="shrink-0 text-[10px] font-bold font-mono uppercase
                                      tracking-wider text-amber bg-amber/10 border border-amber/30
                                      px-1.5 py-0.5 rounded-full leading-none">
                      Host
                    </span>
                  )}
                </p>
                <p className="text-xs text-dim flex items-center gap-1 mt-0.5">
                  {inVoice && <span className="text-online">🎙️ In voice</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}