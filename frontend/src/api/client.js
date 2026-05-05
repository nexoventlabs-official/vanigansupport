import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 30000 });

export const Contacts = {
  list: (params) => api.get('/contacts', { params }).then((r) => r.data),
  create: (body) => api.post('/contacts', body).then((r) => r.data),
  get: (id) => api.get(`/contacts/${id}`).then((r) => r.data),
  update: (id, body) => api.patch(`/contacts/${id}`, body).then((r) => r.data),
  markRead: (id) => api.post(`/contacts/${id}/read`).then((r) => r.data),
  clearChat: (id) => api.delete(`/contacts/${id}/chat`).then((r) => r.data),
  addNote: (id, text) => api.post(`/contacts/${id}/notes`, { text }).then((r) => r.data),
  deleteNote: (id, noteId) => api.delete(`/contacts/${id}/notes/${noteId}`).then((r) => r.data),
};

export const Messages = {
  list: (contactId, params) => api.get(`/messages/${contactId}`, { params }).then((r) => r.data),
  sendText: (contactId, body) => api.post(`/messages/${contactId}/text`, body).then((r) => r.data),
  sendMedia: (contactId, body) => api.post(`/messages/${contactId}/media`, body).then((r) => r.data),
  sendReaction: (contactId, body) => api.post(`/messages/${contactId}/reaction`, body).then((r) => r.data),
  sendTemplate: (contactId, body) => api.post(`/messages/${contactId}/template`, body).then((r) => r.data),
  delete: (id) => api.delete(`/messages/${id}`).then((r) => r.data),
};

export const Templates = {
  list: () => api.get('/templates').then((r) => r.data),
  sync: () => api.post('/templates/sync').then((r) => r.data),
  create: (body) => api.post('/templates', body).then((r) => r.data),
  submit: (id) => api.post(`/templates/${id}/submit`).then((r) => r.data),
  refresh: (id) => api.post(`/templates/${id}/refresh`).then((r) => r.data),
  // Update only the per-button auto-reply texts. Local-only - does not touch Meta.
  // body: { replies: { "<button text>": "<reply text>", ... } }
  updateReplies: (id, replies) => api.patch(`/templates/${id}/replies`, { replies }).then((r) => r.data),
  delete: (id) => api.delete(`/templates/${id}`).then((r) => r.data),
};

export const Uploads = {
  // waId is optional - when provided, file is saved to Cloudinary under wati_panel/<waId>/
  upload: (file, waId, onProgress) => {
    const fd = new FormData();
    fd.append('file', file);
    if (waId) fd.append('waId', String(waId));
    return api.post('/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded * 100) / (e.total || 1))),
    }).then((r) => r.data);
  },
};

export default api;
