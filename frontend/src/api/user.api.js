import { apiClient } from './client.js';

export const userApi = {

  register: (displayName, email, password, dateOfBirth) =>
    apiClient.post('/auth/register', { displayName, email, password, dateOfBirth }).then((r) => r.data),

  login: (email, password) =>
    apiClient.post('/auth/login', { email, password }).then((r) => r.data),

  verifyAge: (dateOfBirth) =>
    apiClient.post('/auth/verify-age', { dateOfBirth }).then((r) => r.data),

  getMe: () =>
    apiClient.get('/auth/me').then((r) => r.data),

  updateProfile: (updates) =>
    apiClient.patch('/auth/profile', updates).then((r) => r.data),

  supabaseCallback: (payload) =>
    apiClient.post('/auth/supabase-callback', payload).then((r) => r.data),
};