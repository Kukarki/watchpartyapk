import { createContext, useContext, useEffect, useCallback } from 'react';
import { useSocketContext } from './SocketContext.jsx';
import { useVoiceStore } from '@/store/voiceStore.js';
import { useAuthStore } from '@/store/authStore.js';
import { useVoice } from '@/hooks/useVoice.js';

const VoiceContext = createContext(null);

// Mounted once at the app root (inside SocketProvider, outside the per-route
// RoomProvider instances) so a voice channel connection — the mic stream and
// RTCPeerConnections owned by useVoice() — survives navigating between
// rooms/pages, instead of being torn down whenever the room page that
// started it unmounts.
export function VoiceProvider({ children }) {
  const { socket, connected, emit } = useSocketContext();
  const { user } = useAuthStore();
  const store = useVoiceStore();

  const {
    startLocalAudio,
    stopLocalAudio,
    destroyAllPeers,
    setMuted,
    remoteStreams,
    peerConnectionStates,
    localStream,
  } = useVoice();

  // ── Voice presence listeners — registered globally, independent of ──
  // ── whichever room page (if any) is currently mounted.               ──
  useEffect(() => {
    const s = socket.current;
    if (!s || !connected) return;

    // Members are keyed by `${roomId}:${channelId}`, not channelId alone —
    // channel ids like "game"/"music" repeat across every room of that type,
    // and with voice now persisting across navigation a client can be
    // subscribed to presence for a different room than the one on screen.
    const handlers = {
      'voice:member_joined': ({ userId: uid, displayName, avatar, roomId, channelId }) => {
        store.addVoiceMember(`${roomId}:${channelId}`, { userId: uid, displayName, avatar, isMuted: false });
      },
      'voice:member_left': ({ userId: uid, roomId, channelId }) => {
        store.removeVoiceMember(`${roomId}:${channelId}`, uid);
      },
      'voice:muted': ({ userId: uid, isMuted }) => {
        store.setVoiceMemberMuted(uid, isMuted);
      },
      'voice:channel_members': ({ roomId, channelId, memberIds }) => {
        store.setChannelMembers(`${roomId}:${channelId}`, memberIds);
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => s.on(event, handler));
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => s.off(event, handler));
    };
  }, [connected, user?.userId]);

  const leaveVoice = useCallback(() => {
    const { roomId, channelId } = useVoiceStore.getState().localVoiceState;
    if (!channelId) return;
    emit('voice:leave', { roomId, channelId });
    stopLocalAudio();
    destroyAllPeers();
    store.resetVoice();
  }, [emit, stopLocalAudio, destroyAllPeers, store]);

  // Joining a new channel while already in one leaves the old one first —
  // a user can only be in one voice channel at a time, same as Discord.
  const joinVoice = useCallback(async (roomId, channelId, channelName, roomName, roomPath) => {
    const current = useVoiceStore.getState().localVoiceState;
    if (current.channelId && current.channelId !== channelId) leaveVoice();

    await startLocalAudio();
    emit('voice:join', { roomId, channelId });
    store.setLocalVoiceState({ roomId, roomName, roomPath, channelId, channelName, isMuted: false });
  }, [emit, startLocalAudio, leaveVoice, store]);

  const toggleMute = useCallback(() => {
    const { roomId, channelId, isMuted } = useVoiceStore.getState().localVoiceState;
    if (!channelId) return;
    const next = !isMuted;
    store.setLocalVoiceState({ isMuted: next });
    setMuted(next);
    emit('voice:mute', { roomId, isMuted: next });
  }, [emit, setMuted, store]);

  // Deafening also mutes the mic (nothing to say if you can't hear anyone
  // reply) — matches Discord's own deafen behavior. Un-deafening leaves
  // mute as-is rather than forcing it back off.
  const toggleDeafen = useCallback(() => {
    const { roomId, channelId, isDeafened } = useVoiceStore.getState().localVoiceState;
    if (!channelId) return;
    const next = !isDeafened;
    store.setLocalVoiceState({ isDeafened: next, ...(next ? { isMuted: true } : {}) });
    if (next) {
      setMuted(true);
      emit('voice:mute', { roomId, isMuted: true });
    }
  }, [emit, setMuted, store]);

  // Leave voice on hard app unmount only — everyday navigation must not
  // trigger this, which is the entire point of hoisting voice up here.
  useEffect(() => () => leaveVoice(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <VoiceContext.Provider value={{
      joinVoice, leaveVoice, toggleMute, toggleDeafen,
      remoteStreams, peerConnectionStates, localStream,
    }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoiceActions() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoiceActions must be used within VoiceProvider');
  return ctx;
}
