/**
 * useSocket — thin wrapper for components that need socket access.
 * For room-specific events, prefer useRoomActions() from RoomContext
 * which centralizes all listener registration.
 */
import { useSocketContext } from '@/contexts/SocketContext.jsx';
export { useSocketContext as useSocket };