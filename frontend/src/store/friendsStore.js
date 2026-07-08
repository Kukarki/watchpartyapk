import { create } from 'zustand';

export const useFriendsStore = create((set) => ({
  friends: [],           // [{ userId, displayName, avatar, online, lastSeenAt }]
  incomingRequests: [],  // [{ requestId, userId, displayName, avatar, createdAt }]
  outgoingRequests: [],
  onlineFriendIds: [],   // userIds currently online, from presence snapshot/updates

  setFriends: (friends) => set({ friends }),

  setRequests: ({ incoming, outgoing }) =>
    set({ incomingRequests: incoming || [], outgoingRequests: outgoing || [] }),

  setOnlineFriendIds: (ids) => set({ onlineFriendIds: ids }),

  applyPresence: (userId, online) =>
    set((s) => {
      const has = s.onlineFriendIds.includes(userId);
      if (online && !has) return { onlineFriendIds: [...s.onlineFriendIds, userId] };
      if (!online && has) return { onlineFriendIds: s.onlineFriendIds.filter((id) => id !== userId) };
      return s;
    }),

  removeFriend: (friendId) =>
    set((s) => ({ friends: s.friends.filter((f) => f.userId !== friendId) })),

  removeIncomingRequest: (requestId) =>
    set((s) => ({ incomingRequests: s.incomingRequests.filter((r) => r.requestId !== requestId) })),

  removeOutgoingRequest: (requestId) =>
    set((s) => ({ outgoingRequests: s.outgoingRequests.filter((r) => r.requestId !== requestId) })),

  reset: () => set({ friends: [], incomingRequests: [], outgoingRequests: [], onlineFriendIds: [] }),
}));
