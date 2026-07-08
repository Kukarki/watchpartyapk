import { apiClient } from './client.js';

export const friendApi = {
  request: (payload) =>
    apiClient.post('/friends/request', payload).then((r) => r.data),

  respond: (requestId, action) =>
    apiClient.post('/friends/respond', { requestId, action }).then((r) => r.data),

  list: () =>
    apiClient.get('/friends').then((r) => r.data),

  listRequests: () =>
    apiClient.get('/friends/requests').then((r) => r.data),

  remove: (friendId) =>
    apiClient.delete(`/friends/${friendId}`).then((r) => r.data),

  search: (query) =>
    apiClient.post('/friends/search', { query }).then((r) => r.data),
};
