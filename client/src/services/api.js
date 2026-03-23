import api from '../hooks/useApi.js';

// Auth API
export const authAPI = {
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },
  register: async (email, password, role = 'client') => {
    const res = await api.post('/auth/register', { email, password, role });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  createFirstAdmin: async (email, password) => {
    const res = await api.post('/auth/first-admin', { email, password });
    return res.data;
  },
};

// Couples API
export const couplesAPI = {
  list: async () => {
    const res = await api.get('/couples');
    return res.data;
  },
  create: async ({ person_a_name, person_b_name, client_user_id }) => {
    const res = await api.post('/couples', { person_a_name, person_b_name, client_user_id });
    return res.data;
  },
  get: async (id) => {
    const res = await api.get(`/couples/${id}`);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/couples/${id}`);
    return res.data;
  },
  grantAccess: async (coupleId, clientUserId) => {
    const res = await api.post(`/couples/${coupleId}/access`, { client_user_id: clientUserId });
    return res.data;
  },
};

// Templates API
export const templatesAPI = {
  list: async () => {
    const res = await api.get('/templates');
    return res.data;
  },
  create: async ({ name, description, prompt_text, category, is_active }) => {
    const res = await api.post('/templates', { name, description, prompt_text, category, is_active });
    return res.data;
  },
  update: async (id, updates) => {
    const res = await api.put(`/templates/${id}`, updates);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/templates/${id}`);
    return res.data;
  },
  generateReference: async (id) => {
    const res = await api.post(`/templates/${id}/reference`);
    return res.data;
  },
};

// Merges API
export const mergesAPI = {
  list: async () => {
    const res = await api.get('/merges');
    return res.data;
  },
  create: async ({ couple_id, template_id, irisAFile, irisBFile }) => {
    const formData = new FormData();
    formData.append('couple_id', couple_id);
    formData.append('template_id', template_id);
    formData.append('iris_a', irisAFile);
    formData.append('iris_b', irisBFile);

    const res = await api.post('/merges', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000, // 3 minutes for AI generation
    });
    return res.data;
  },
  get: async (id) => {
    const res = await api.get(`/merges/${id}`);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/merges/${id}`);
    return res.data;
  },
};

// Client API
export const clientAPI = {
  unlock: async (password, couple_id) => {
    const res = await api.post('/client/unlock', { password, couple_id });
    return res.data;
  },
  getAccess: async () => {
    const res = await api.get('/client/access');
    return res.data;
  },
  getMerges: async (coupleId) => {
    const res = await api.get(`/client/merges/${coupleId}`);
    return res.data;
  },
};

// Cleanup API
export const cleanupAPI = {
  run: async (daysOld = 30) => {
    const res = await api.post('/cleanup', { days_old: daysOld });
    return res.data;
  },
  getStats: async (daysOld = 30) => {
    const res = await api.get(`/cleanup/stats?days_old=${daysOld}`);
    return res.data;
  },
};
