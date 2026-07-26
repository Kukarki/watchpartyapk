import { useVoiceStore } from '@/store/voiceStore.js';
import { useRoomActions } from '@/contexts/RoomContext.jsx';
import { useVoiceActions } from '@/contexts/VoiceContext.jsx';
import { useAudioLevel } from '@/hooks/useAudioLevel.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import VoiceMember from './VoiceMember.jsx';
import VoiceControls from './VoiceControls.jsx';
import toast from 'react-hot-toast';

export default function VoiceChannel({ channelId = 'general', channelName = 'General' }) {
  const { voiceMembers, localVoiceState } = useVoiceStore();
  const { roomId, joinVoice, leaveVoice, toggleMute, toggleDeafen } = useRoomActions();
  const { remoteStreams, peerConnectionStates, localStream } = useVoiceActions();
  const { user } = useAuth();

  // Members are keyed by `${roomId}:${channelId}` — "game"/"music" repeat
  // across every room of that type, and voice now persists across
  // navigation, so channelId alone would bleed members between rooms.
  const members = voiceMembers[`${roomId}:${channelId}`] || [];
  const isInChannel = localVoiceState.channelId === channelId && localVoiceState.roomId === roomId;
  const localLevel = useAudioLevel(isInChannel ? localStream : null);

  const handleJoin = async () => {
    try {
      await joinVoice(channelId, channelName);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        toast.error('Microphone permission denied');
      } else {
        toast.error('Could not access microphone');
      }
    }
  };

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

        {!isInChannel && (
          <button
            onClick={handleJoin}
            className="btn-ghost text-xs px-3 py-1 text-online hover:text-online
                        border border-online/20 hover:border-online/40 hover:bg-online/5"
          >
            Join Voice
          </button>
        )}
      </div>

      {/* Member list */}
      {members.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {members.map((member) => {
            const isSelf = member.userId === user?.userId;
            return (
              <VoiceMember
                key={member.userId}
                member={member}
                isSelf={isSelf}
                connectionState={isSelf ? 'connected' : peerConnectionStates[member.userId]}
                stream={isSelf ? null : remoteStreams[member.userId]}
              />
            );
          })}
        </div>
      )}

      {/* Controls (only visible when in channel) */}
      {isInChannel && (
        <div className="border-t border-border/50 pt-2 mt-1">
          <VoiceControls
            isMuted={localVoiceState.isMuted}
            isDeafened={localVoiceState.isDeafened}
            isSpeaking={!localVoiceState.isMuted && localLevel > 0.08}
            onToggleMute={toggleMute}
            onToggleDeafen={toggleDeafen}
            onLeave={leaveVoice}
            user={user}
          />
        </div>
      )}
    </div>
  );
}
