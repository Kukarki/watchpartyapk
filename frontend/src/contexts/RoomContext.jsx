import { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSocketContext } from './SocketContext.jsx';
import { useVoiceActions } from './VoiceContext.jsx';
import { useRoomStore } from '@/store/roomStore.js';
import { useAuthStore } from '@/store/authStore.js';

const RoomContext = createContext(null);

export function RoomProvider({ children }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { socket, connected, emit } = useSocketContext();
  const { user } = useAuthStore();
  const store = useRoomStore();
  const voiceActions = useVoiceActions();
  const joinedRef = useRef(false);

  // ── Register socket listeners whenever the connection (re)establishes ──
  useEffect(() => {
    const s = socket.current;
    if (!s || !connected) return;

    const handlers = {
      'room:joined': ({ room, members, chatHistory, videoState }) => {
        store.setRoom(room);
        store.setMembers(members || []);
        store.setMessages(chatHistory || []);
        if (videoState) store.setVideoState(videoState);
        joinedRef.current = true;
      },

      'room:member_joined': ({ member }) => {
        store.addMember(member);
        toast(`${member.displayName} joined`, { icon: '👋' });
      },

      'room:member_left': ({ userId, displayName }) => {
        store.removeMember(userId);
        toast(`${displayName} left`, { icon: '🚪' });
      },

      'member:avatar_updated': ({ userId: uid, equippedItems }) => {
        store.updateMemberEquippedItems(uid, equippedItems);
      },

      'room:error': ({ code, message }) => {
        toast.error(message || 'Room error');
        if (code === 'NOT_FOUND') navigate('/home');
      },

      'video:play': ({ currentTime, timestamp }) => {
        store.setVideoState({ isPlaying: true, currentTime, updatedAt: timestamp });
      },

      'video:pause': ({ currentTime, timestamp }) => {
        store.setVideoState({ isPlaying: false, currentTime, updatedAt: timestamp });
      },

      'video:seek': ({ currentTime, timestamp }) => {
        store.setVideoState({ currentTime, updatedAt: timestamp });
      },

      'video:state': (state) => {
        store.setVideoState(state);
      },

      'chat:message': ({ message }) => {
        store.addMessage(message);
      },

      'chat:reaction': ({ messageId, emoji, userId: uid }) => {
        store.applyReaction(messageId, emoji, uid);
      },

      'chat:typing': ({ userId: uid, displayName, isTyping }) => {
        if (uid === user?.userId) return;
        store.setTyping(uid, displayName, isTyping);
      },

      // voice:* presence events are handled globally in VoiceContext.jsx —
      // voice state must survive this room's own mount/unmount lifecycle.

      'game:state': ({ state, events }) => {
        store.setGameState(state);
        for (const evt of events || []) {
          const player = state.players?.find((p) => p.userId === evt.playerId);
          const name = player?.displayName || 'Someone';
          if (evt.type === 'captured') {
            toast(`${name} captured a token!`, { icon: '💥' });
          } else if (evt.type === 'token_finished') {
            toast(`${name} got a token home!`, { icon: '🏠' });
          } else if (evt.type === 'game_won') {
            toast.success(`${name} won the game! 🎉`, { duration: 6000 });
          } else if (evt.type === 'forfeit_three_sixes') {
            toast(`${name} rolled three 6s in a row — turn forfeited!`, { icon: '😬' });
          } else if (evt.type === 'game_started') {
            toast.success('Game started!');
          }
        }
      },

      'game:error': ({ message }) => {
        toast.error(message || 'Game error');
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => s.on(event, handler));

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => s.off(event, handler));
    };
  }, [connected, user?.userId]);

  // ── Reset store only when the room changes, not on reconnect ─
  useEffect(() => {
    // Guard: if we've already joined (StrictMode re-run), don't clear live state
    if (!joinedRef.current) store.reset();
    joinedRef.current = false;
    // No cleanup — store is reset again on the next room entry
  }, [roomId]);

  // ── Join room when connected (re-join on reconnect too) ───────
  useEffect(() => {
    if (!connected || !roomId) return;

    // Small delay ensures listeners are bound before server responds
    const t = setTimeout(() => {
      emit('room:join', { roomId });
    }, 150);

    return () => {
      clearTimeout(t);
      emit('room:leave', { roomId });
    };
  }, [connected, roomId]);

  // ── Action dispatchers ────────────────────────────────────

  const sendPlay = useCallback((currentTime) => {
    const timestamp = Date.now();
    emit('video:play', { roomId, currentTime, timestamp });
    store.setVideoState({ isPlaying: true, currentTime, updatedAt: timestamp });
  }, [emit, roomId, store]);

  const sendPause = useCallback((currentTime) => {
    const timestamp = Date.now();
    emit('video:pause', { roomId, currentTime, timestamp });
    store.setVideoState({ isPlaying: false, currentTime, updatedAt: timestamp });
  }, [emit, roomId, store]);

  const sendSeek = useCallback((currentTime) => {
    const timestamp = Date.now();
    emit('video:seek', { roomId, currentTime, timestamp });
    store.setVideoState({ currentTime, updatedAt: timestamp });
  }, [emit, roomId, store]);

  const sendChangeUrl = useCallback((videoUrl, meta = {}) => {
    emit('video:change_url', { roomId, videoUrl, title: meta.title, thumbnail: meta.thumbnail, type: meta.type });
    store.setVideoUrl(videoUrl);
  }, [emit, roomId]);

  const requestSync = useCallback(() => {
    emit('video:sync_request', { roomId });
  }, [emit, roomId]);

  const sendMessage = useCallback((content) => {
    emit('chat:message', { roomId, content });
  }, [emit, roomId]);

  const sendReaction = useCallback((messageId, emoji) => {
    emit('chat:reaction', { roomId, messageId, emoji });
    // Also apply locally so the sender sees it immediately
    useRoomStore.getState().applyReaction(messageId, emoji, user?.userId);
  }, [emit, roomId, user]);

  const sendTyping = useCallback((isTyping) => {
    emit('chat:typing', { roomId, isTyping });
  }, [emit, roomId]);

  // Thin wrappers around the app-root VoiceContext, pre-filling this room's
  // id/name — voice connections themselves now live in VoiceContext so they
  // survive navigating away from this room (see VoiceContext.jsx).
  const joinVoice = useCallback((channelId = 'general', channelName) => {
    return voiceActions.joinVoice(roomId, channelId, channelName, store.room?.name, location.pathname);
  }, [voiceActions, roomId, store.room?.name, location.pathname]);

  const leaveVoice = useCallback(() => {
    voiceActions.leaveVoice();
  }, [voiceActions]);

  const toggleMute = useCallback(() => {
    voiceActions.toggleMute();
  }, [voiceActions]);

  const toggleDeafen = useCallback(() => {
    voiceActions.toggleDeafen();
  }, [voiceActions]);

  const startGame = useCallback((opts = {}) => {
    emit('game:start', { roomId, ...opts });
  }, [emit, roomId]);

  const sendGameAction = useCallback((action) => {
    emit('game:action', { roomId, action });
  }, [emit, roomId]);

  return (
    <RoomContext.Provider value={{
      roomId,
      sendPlay, sendPause, sendSeek, sendChangeUrl, requestSync,
      sendMessage, sendReaction, sendTyping,
      joinVoice, leaveVoice, toggleMute, toggleDeafen,
      startGame, sendGameAction,
    }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoomActions() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoomActions must be used within RoomProvider');
  return ctx;
}