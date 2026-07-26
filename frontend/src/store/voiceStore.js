import { create } from 'zustand';

// Voice state lives in its own store, separate from roomStore, specifically
// so it survives roomStore.reset() (fired on every room navigation) — a
// voice channel connection is meant to persist across page/room changes,
// not get wiped the instant the room you joined it from unmounts.
export const useVoiceStore = create((set) => ({
  voiceMembers: {},  // { channelId: [{ userId, displayName, avatar, isMuted }] }
  localVoiceState: {
    roomId: null,
    roomName: null,
    roomPath: null,
    channelId: null,
    channelName: null,
    isMuted: false,
    isDeafened: false,
  },

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

  setChannelMembers: (channelId, memberIds) =>
    set((s) => ({
      voiceMembers: {
        ...s.voiceMembers,
        [channelId]: memberIds.map((userId) => ({ userId, isMuted: false })),
      },
    })),

  setLocalVoiceState: (patch) =>
    set((s) => ({ localVoiceState: { ...s.localVoiceState, ...patch } })),

  // Only called on an explicit leave — never on room navigation.
  resetVoice: () =>
    set({
      voiceMembers: {},
      localVoiceState: {
        roomId: null, roomName: null, roomPath: null, channelId: null, channelName: null,
        isMuted: false, isDeafened: false,
      },
    }),
}));
