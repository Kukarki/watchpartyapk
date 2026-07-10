import { apiClient } from './client.js';

export const spotifyApi = {
  getAuthUrl: () =>
    apiClient.get('/spotify/auth-url').then((r) => r.data),

  submitCallback: (code) =>
    apiClient.post('/spotify/callback', { code }).then((r) => r.data),

  getNowPlaying: () =>
    apiClient.get('/spotify/now-playing').then((r) => r.data),

  disconnect: () =>
    apiClient.delete('/spotify/connection').then((r) => r.data),
};
