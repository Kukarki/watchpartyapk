import { apiClient } from './client.js';

export const youtubeApi = {
  getAuthUrl: () =>
    apiClient.get('/youtube/auth-url').then((r) => r.data),

  submitCallback: (code) =>
    apiClient.post('/youtube/callback', { code }).then((r) => r.data),

  search: (query) =>
    apiClient.get('/youtube/search', { params: { q: query } }).then((r) => r.data),

  listPlaylists: () =>
    apiClient.get('/youtube/playlists').then((r) => r.data),

  importPlaylist: (playlistId, name) =>
    apiClient.post(`/youtube/playlists/${playlistId}/import`, { name }).then((r) => r.data),

  disconnect: () =>
    apiClient.delete('/youtube/connection').then((r) => r.data),
};
