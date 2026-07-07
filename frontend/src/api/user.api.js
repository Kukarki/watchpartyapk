import { apiClient } from './client.js';

export const userApi = {
  guestLogin: (displayName) =>
    apiClient.post('/auth/guest', { displayName }).then((r) => r.data),

  register: (displayName, email, password) =>
    apiClient.post('/auth/register', { displayName, email, password }).then((r) => r.data),

  login: (email, password) =>
    apiClient.post('/auth/login', { email, password }).then((r) => r.data),

  getMe: () =>
    apiClient.get('/auth/me').then((r) => r.data),

  updateProfile: (updates) =>
    apiClient.patch('/auth/profile', updates).then((r) => r.data),

  supabaseCallback: (payload) =>
    apiClient.post('/auth/supabase-callback', payload).then((r) => r.data),
};