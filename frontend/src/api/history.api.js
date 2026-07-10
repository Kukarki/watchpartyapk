import { apiClient } from './client.js';

export const historyApi = {
  list: (limit = 20) =>
    apiClient.get('/history', { params: { limit } }).then((r) => r.data),
};
