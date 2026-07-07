import { useCallback, useRef } from 'react';
import { useRoomStore } from '@/store/roomStore.js';
import { useRoomActions } from '@/contexts/RoomContext.jsx';

const TYPING_DEBOUNCE_MS = 1500;

export function useChat() {
  const { messages, typingUsers } = useRoomStore();
  const { sendMessage, sendReaction, sendTyping } = useRoomActions();

  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const handleTypingStart = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(true);
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTyping(false);
    }, TYPING_DEBOUNCE_MS);
  }, [sendTyping]);

  const submitMessage = useCallback((content) => {
    const trimmed = content?.trim();
    if (!trimmed) return;
    // Stop typing indicator
    clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    sendTyping(false);
    sendMessage(trimmed);
  }, [sendMessage, sendTyping]);

  const reactToMessage = useCallback((messageId, emoji) => {
    sendReaction(messageId, emoji);
  }, [sendReaction]);

  const typingList = Object.values(typingUsers).map((u) => u.displayName);

  return {
    messages,
    typingList,
    submitMessage,
    reactToMessage,
    handleTypingStart,
  };
}