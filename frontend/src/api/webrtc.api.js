import { apiClient } from './client.js';

export const webrtcApi = {
  getIceServers: () =>
    apiClient.get('/webrtc/ice-servers').then((r) => r.data),
};
