import { useState } from 'react';
import { useRoomStore } from '@/store/roomStore.js';
import { useFriendsStore } from '@/store/friendsStore.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useSocketContext } from '@/contexts/SocketContext.jsx';
import Avatar from '@/components/ui/Avatar.jsx';
import toast from 'react-hot-toast';

export default function MemberList() {
  const { members, room, voiceMembers } = useRoomStore();
  const { user } = useAuth();
  const [showInvite, setShowInvite] = useState(false);

  const voiceUserIds = new Set(
    Object.values(voiceMembers).flatMap((ch) => ch.map((m) => m.userId))
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <p className="text-xs font-mono text-dim uppercase tracking-widest">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="btn-ghost text-xs px-2.5 py-1"
        >
          Invite Friends
        </button>
      </div>

      {showInvite && (
        <InviteFriendsModal roomId={room?.id} onClose={() => setShowInvite(false)} />
      )}

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

function InviteFriendsModal({ roomId, onClose }) {
  const { friends, onlineFriendIds } = useFriendsStore();
  const { emit } = useSocketContext();
  const [invited, setInvited] = useState(new Set());

  const onlineSet = new Set(onlineFriendIds);
  const sorted = [...friends].sort((a, b) => Number(onlineSet.has(b.userId)) - Number(onlineSet.has(a.userId)));

  const handleInvite = (friend) => {
    if (!roomId) return;
    emit('friend:invite', { toUserId: friend.userId, roomId });
    setInvited((s) => new Set(s).add(friend.userId));
    toast.success(`Invited ${friend.displayName}`);
  };

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-void/60" onClick={onClose} />
      <div className="fixed z-[9999] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                       w-[320px] max-h-[70vh] card flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold text-bright">Invite Friends</p>
          <button type="button" onClick={onClose} className="text-dim hover:text-bright text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sorted.length === 0 && (
            <p className="text-sub text-sm px-2 py-4">No friends to invite yet.</p>
          )}
          {sorted.map((f) => {
            const online = onlineSet.has(f.userId);
            const alreadyInvited = invited.has(f.userId);
            return (
              <div key={f.userId} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-raised">
                <div className="relative shrink-0">
                  <Avatar src={f.avatar} name={f.displayName} size="sm" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface
                                ${online ? 'bg-online' : 'bg-dim'}`}
                  />
                </div>
                <p className="flex-1 min-w-0 text-sm text-bright truncate">{f.displayName}</p>
                <button
                  type="button"
                  onClick={() => handleInvite(f)}
                  disabled={alreadyInvited}
                  className="btn-primary text-xs px-2.5 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {alreadyInvited ? 'Sent' : 'Invite'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
