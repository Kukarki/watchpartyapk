import { apiClient } from './client.js';

export const vroidHubApi = {
  getAuthUrl: () =>
    apiClient.get('/vroid-hub/auth-url').then((r) => r.data),

  submitCallback: (code) =>
    apiClient.post('/vroid-hub/callback', { code }).then((r) => r.data),

  listModels: () =>
    apiClient.get('/vroid-hub/models').then((r) => r.data),

  selectModel: (modelId) =>
    apiClient.post('/vroid-hub/select', { modelId }).then((r) => r.data),

  getAvatarUrl: () =>
    apiClient.get('/vroid-hub/avatar-url').then((r) => r.data),

  disconnect: () =>
    apiClient.delete('/vroid-hub/connection').then((r) => r.data),
};
