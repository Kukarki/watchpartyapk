import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore.js';

const SocketContext = createContext(null);
// Connect through the same origin as the page.
// This means Vite's /socket.io proxy (dev) and Cloudflare tunnel (remote
// devices) both route traffic to the real backend — rather than hardcoding
// localhost:4000 which only works on the host machine.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const { token, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Not logged in — disconnect and stop
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    // Already connected with the same token — do nothing
    if (socketRef.current?.connected && socketRef.current?._auth?.token === token) {
      return;
    }

    // Disconnect old socket if token changed
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }

    // Create new socket with current token
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    // Store token on socket for change detection
    socket._auth = { token };

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      // Only mark disconnected if not a deliberate client disconnect
      if (reason !== 'io client disconnect') {
        setConnected(false);
      }
    });

    socket.on('connect_error', () => {
      setConnected(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, isAuthenticated]);

  const emit = useCallback((event, payload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, payload);
    }
    // Silently drop events when disconnected — reconnect will re-join room
  }, []);

  const on = useCallback((event, handler) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef, connected, emit, on }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketContext must be used within SocketProvider');
  return ctx;
}