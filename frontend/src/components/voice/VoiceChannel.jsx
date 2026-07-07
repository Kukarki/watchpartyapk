import { useEffect } from 'react';
import { useRoomStore } from '@/store/roomStore.js';
import { useRoomActions } from '@/contexts/RoomContext.jsx';
import { useVoice } from '@/hooks/useVoice.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import VoiceMember from './VoiceMember.jsx';
import VoiceControls from './VoiceControls.jsx';
import toast from 'react-hot-toast';

export default function VoiceChannel({ channelId = 'general', channelName = 'General' }) {
  const { voiceMembers, localVoiceState } = useRoomStore();
  const { joinVoice, leaveVoice, toggleMute } = useRoomActions();
  const { startLocalAudio, stopLocalAudio, destroyAllPeers } = useVoice();
  const { user } = useAuth();

  const members = voiceMembers[channelId] || [];
  const isInChannel = localVoiceState.channelId === channelId;

  const handleJoin = async () => {
    try {
      await startLocalAudio();
      joinVoice(channelId);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        toast.error('Microphone permission denied');
      } else {
        toast.error('Could not access microphone');
      }
    }
  };

  const handleLeave = () => {
    leaveVoice();
    stopLocalAudio();
    destroyAllPeers();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localVoiceState.channelId === channelId) {
        handleLeave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-3 py-2">
      {/* Channel header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-online text-xs">🔊</span>
          <span className="text-sub text-xs font-mono uppercase tracking-widest">
            {channelName}
          </span>
          {members.length > 0 && (
            <span className="text-dim text-xs bg-raised border border-border
                              rounded-full px-2 py-0.5 font-mono">
              {members.length}
            </span>
          )}
        </div>

        {!isInChannel ? (
          <button
            onClick={handleJoin}
            className="btn-ghost text-xs px-3 py-1 text-online hover:text-online
                        border border-online/20 hover:border-online/40 hover:bg-online/5"
          >
            Join Voice
          </button>
        ) : (
          <button
            onClick={handleLeave}
            className="btn-ghost text-xs px-3 py-1 text-danger hover:text-danger
                        border border-danger/20 hover:border-danger/40 hover:bg-danger/5"
          >
            Leave
          </button>
        )}
      </div>

      {/* Member list */}
      {members.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {members.map((member) => (
            <VoiceMember
              key={member.userId}
              member={member}
              isSelf={member.userId === user?.userId}
            />
          ))}
        </div>
      )}

      {/* Controls (only visible when in channel) */}
      {isInChannel && (
        <div className="border-t border-border/50 pt-2 mt-1">
          <VoiceControls
            isMuted={localVoiceState.isMuted}
            onToggleMute={toggleMute}
            user={user}
          />
        </div>
      )}
    </div>
  );
}