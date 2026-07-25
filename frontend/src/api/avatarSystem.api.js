import { apiClient } from './client.js';

const BASE = '/avatar-system';

export const avatarSystemApi = {
  getAvatar: () =>
    apiClient.get(`${BASE}/avatar/me`).then((r) => r.data),

  saveAvatarUrl: (avatarUrl) =>
    apiClient.put(`${BASE}/avatar/me`, { avatarUrl }).then((r) => r.data),

  getCatalog: () =>
    apiClient.get(`${BASE}/catalog/manifest`).then((r) => r.data),

  getInventory: () =>
    apiClient.get(`${BASE}/inventory/me`).then((r) => r.data),

  equipItem: (itemId) =>
    apiClient.post(`${BASE}/inventory/${itemId}/equip`).then((r) => r.data),

  unequipItem: (itemId) =>
    apiClient.post(`${BASE}/inventory/${itemId}/unequip`).then((r) => r.data),
};
