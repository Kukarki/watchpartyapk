import { apiClient } from './client.js';

export const roomApi = {
  createRoom: (payload) =>
    apiClient.post('/rooms', payload).then((r) => r.data),

  getRoom: (roomId) =>
    apiClient.get(`/rooms/${roomId}`).then((r) => r.data),

  getChatHistory: (roomId, count = 50) =>
    apiClient.get(`/rooms/${roomId}/chat`, { params: { count } }).then((r) => r.data),
};

export const queueApi = {
  getQueue: (roomId) =>
    apiClient.get(`/rooms/${roomId}/queue`).then((r) => r.data),

  addToQueue: (roomId, item) =>
    apiClient.post(`/rooms/${roomId}/queue`, item).then((r) => r.data),

  voteItem: (roomId, itemId) =>
    apiClient.post(`/rooms/${roomId}/queue/${itemId}/vote`).then((r) => r.data),

  removeItem: (roomId, itemId) =>
    apiClient.delete(`/rooms/${roomId}/queue/${itemId}`).then((r) => r.data),

  playNext: (roomId) =>
    apiClient.post(`/rooms/${roomId}/queue/play-next`).then((r) => r.data),
};

export const pollApi = {
  getActive: (roomId) =>
    apiClient.get(`/rooms/${roomId}/polls/active`).then((r) => r.data),

  create: (roomId, payload) =>
    apiClient.post(`/rooms/${roomId}/polls`, payload).then((r) => r.data),

  vote: (roomId, pollId, optionIndex) =>
    apiClient.post(`/rooms/${roomId}/polls/${pollId}/vote/${optionIndex}`).then((r) => r.data),

  end: (roomId, pollId) =>
    apiClient.patch(`/rooms/${roomId}/polls/${pollId}/end`).then((r) => r.data),
};