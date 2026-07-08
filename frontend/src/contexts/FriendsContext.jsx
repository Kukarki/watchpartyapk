import { createContext, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSocketContext } from './SocketContext.jsx';
import { useAuthStore } from '@/store/authStore.js';
import { useFriendsStore } from '@/store/friendsStore.js';
import { friendApi } from '@/api/friend.api.js';

const FriendsContext = createContext(null);

export function FriendsProvider({ children }) {
  const { socket, connected } = useSocketContext();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const store = useFriendsStore();

  const refetchFriends = useCallback(async () => {
    try {
      const { friends } = await friendApi.list();
      store.setFriends(friends || []);
    } catch {
      // non-fatal — presence/list will retry on next reconnect or user action
    }
  }, []);

  const refetchRequests = useCallback(async () => {
    try {
      const { incoming, outgoing } = await friendApi.listRequests();
      store.setRequests({ incoming, outgoing });
    } catch {
      // non-fatal
    }
  }, []);

  // ── Load friends/requests once authenticated ────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      store.reset();
      return;
    }
    refetchFriends();
    refetchRequests();
  }, [isAuthenticated]);

  // ── Presence + invite socket listeners ───────────────────────────────────
  useEffect(() => {
    const s = socket.current;
    if (!s || !connected) return;

    const handlers = {
      'presence:snapshot': ({ onlineFriendIds }) => {
        store.setOnlineFriendIds(onlineFriendIds || []);
      },

      'presence:update': ({ userId, online }) => {
        store.applyPresence(userId, online);
      },

      'friend:invited': ({ fromUser, roomId }) => {
        toast((t) => (
          <div className="flex items-center gap-3">
            <span>{fromUser?.displayName || 'A friend'} invited you to a room</span>
            <button
              type="button"
              onClick={() => { toast.dismiss(t.id); navigate(`/room/${roomId}`); }}
              className="shrink-0 rounded-lg bg-amber px-2.5 py-1 text-xs font-semibold text-void"
            >
              Join
            </button>
          </div>
        ), { duration: 8000, icon: '🎬' });
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => s.on(event, handler));
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => s.off(event, handler));
    };
  }, [connected]);

  return (
    <FriendsContext.Provider value={{ refetchFriends, refetchRequests }}>
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriends() {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error('useFriends must be used within FriendsProvider');
  return ctx;
}
