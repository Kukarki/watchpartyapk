import { apiClient } from './client.js';

export const playlistApi = {
  list: () =>
    apiClient.get('/playlists').then((r) => r.data),

  create: (name) =>
    apiClient.post('/playlists', { name }).then((r) => r.data),

  get: (playlistId) =>
    apiClient.get(`/playlists/${playlistId}`).then((r) => r.data),

  getShared: (shareCode) =>
    apiClient.get(`/playlists/shared/${shareCode}`).then((r) => r.data),

  update: (playlistId, updates) =>
    apiClient.patch(`/playlists/${playlistId}`, updates).then((r) => r.data),

  remove: (playlistId) =>
    apiClient.delete(`/playlists/${playlistId}`).then((r) => r.data),

  addTrack: (playlistId, track) =>
    apiClient.post(`/playlists/${playlistId}/tracks`, track).then((r) => r.data),

  removeTrack: (playlistId, trackId) =>
    apiClient.delete(`/playlists/${playlistId}/tracks/${trackId}`).then((r) => r.data),

  importToRoom: (playlistId, roomId) =>
    apiClient.post(`/playlists/${playlistId}/import-to-room/${roomId}`).then((r) => r.data),
};
