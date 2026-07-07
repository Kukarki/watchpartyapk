import { create } from 'zustand';

export const useRoomStore = create((set, get) => ({
  // Room metadata
  room: null,
  members: [],

  // Video state
  videoState: {
    videoUrl: '',
    isPlaying: false,
    currentTime: 0,
    updatedAt: 0,
  },

  // Chat
  messages: [],
  typingUsers: {},   // { userId: { displayName, timeout } }

  // Voice
  voiceMembers: {},  // { channelId: [{ userId, displayName, avatar, isMuted }] }
  localVoiceState: {
    channelId: null,
    isMuted: false,
    isDeafened: false,
  },

  // UI
  isChatOpen: true,
  isVoicePanelOpen: true,

  // ── Actions ─────────────────────────────────────────────

  setRoom: (room) => set({ room }),

  setMembers: (members) => set({ members }),

  addMember: (member) =>
    set((s) => ({
      members: s.members.some((m) => m.userId === member.userId)
        ? s.members
        : [...s.members, member],
    })),

  removeMember: (userId) =>
    set((s) => ({ members: s.members.filter((m) => m.userId !== userId) })),

  // ── Video ─────────────────────────────────────────────

  setVideoState: (patch) =>
    set((s) => ({ videoState: { ...s.videoState, ...patch } })),

  setVideoUrl: (url) =>
    set((s) => ({ videoState: { ...s.videoState, videoUrl: url, currentTime: 0, isPlaying: false } })),

  // ── Chat ──────────────────────────────────────────────

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((s) => ({
      messages: s.messages.some((m) => m.id === message.id)
        ? s.messages
        : [...s.messages, message],
    })),

  applyReaction: (messageId, emoji, userId) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== messageId) return m;

        const rawReactions = m.reactions && typeof m.reactions === 'object' && !Array.isArray(m.reactions)
          ? { ...m.reactions }
          : {};

        const users = Array.isArray(rawReactions[emoji]) ? [...rawReactions[emoji]] : [];

        if (users.includes(userId)) {
          rawReactions[emoji] = users.filter((id) => id !== userId);
          if (rawReactions[emoji].length === 0) delete rawReactions[emoji];
        } else {
          rawReactions[emoji] = [...users, userId];
        }

        return { ...m, reactions: rawReactions };
      }),
    })),

  setTyping: (userId, displayName, isTyping) =>
    set((s) => {
      const typingUsers = { ...s.typingUsers };
      if (isTyping) {
        // Clear previous timeout
        if (typingUsers[userId]?.timeout) clearTimeout(typingUsers[userId].timeout);
        const timeout = setTimeout(() => {
          get().setTyping(userId, displayName, false);
        }, 4000);
        typingUsers[userId] = { displayName, timeout };
      } else {
        if (typingUsers[userId]?.timeout) clearTimeout(typingUsers[userId].timeout);
        delete typingUsers[userId];
      }
      return { typingUsers };
    }),

  // ── Voice ─────────────────────────────────────────────

  addVoiceMember: (channelId, member) =>
    set((s) => {
      const channel = s.voiceMembers[channelId] || [];
      if (channel.some((m) => m.userId === member.userId)) return s;
      return { voiceMembers: { ...s.voiceMembers, [channelId]: [...channel, member] } };
    }),

  removeVoiceMember: (channelId, userId) =>
    set((s) => ({
      voiceMembers: {
        ...s.voiceMembers,
        [channelId]: (s.voiceMembers[channelId] || []).filter((m) => m.userId !== userId),
      },
    })),

  setVoiceMemberMuted: (userId, isMuted) =>
    set((s) => {
      const voiceMembers = { ...s.voiceMembers };
      for (const ch of Object.keys(voiceMembers)) {
        voiceMembers[ch] = voiceMembers[ch].map((m) =>
          m.userId === userId ? { ...m, isMuted } : m
        );
      }
      return { voiceMembers };
    }),

  setLocalVoiceState: (patch) =>
    set((s) => ({ localVoiceState: { ...s.localVoiceState, ...patch } })),

  setChannelMembers: (channelId, memberIds) =>
    set((s) => ({
      voiceMembers: {
        ...s.voiceMembers,
        [channelId]: memberIds.map((userId) => ({ userId, isMuted: false })),
      },
    })),

  // ── UI ────────────────────────────────────────────────

  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  toggleVoicePanel: () => set((s) => ({ isVoicePanelOpen: !s.isVoicePanelOpen })),

  reset: () =>
    set({
      room: null,
      members: [],
      videoState: { videoUrl: '', isPlaying: false, currentTime: 0, updatedAt: 0 },
      messages: [],
      typingUsers: {},
      voiceMembers: {},
      localVoiceState: { channelId: null, isMuted: false, isDeafened: false },
    }),
}));