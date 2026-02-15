import axios from 'axios';

// 自动检测 API URL
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `http://${hostname}:7749`;
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:7749';
};

const API_BASE_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`
});

// 请求拦截器：自动添加 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token') || 'wj12345';
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理 401 错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export const getDashboardData = () => api.get('/status');
export const getSessions = () => api.get('/sessions');
export const getSessionMessages = (sessionId: string, params?: { limit?: number; offset?: number; filter?: string }) =>
  api.get(`/sessions/${sessionId}/messages`, { params });
export const deleteSession = (sessionKey: string) => api.delete(`/sessions/${encodeURIComponent(sessionKey)}`);
export const getModels = () => api.get('/models');
export const getSkills = () => api.get('/skills');
export const getLogs = () => api.get('/logs');

// Providers
export const getProviders = () => api.get('/providers');
export const createProvider = (data: any) => api.post('/providers', data);
export const updateProvider = (name: string, data: any) => api.put(`/providers/${name}`, data);
export const deleteProvider = (name: string) => api.delete(`/providers/${name}`);
export const setDefaultModel = (data: any) => api.put('/providers/default-model', data);

// Tasks
export const getTasks = () => api.get('/tasks');
export const createCronJob = (data: any) => api.post('/tasks/cron', data);
export const updateCronJob = (id: string, data: any) => api.put(`/tasks/cron/${id}`, data);
export const deleteCronJob = (id: string) => api.delete(`/tasks/cron/${id}`);

// Channels
export const getChannels = () => api.get('/channels');
export const createChannel = (data: any) => api.post('/channels', data);
export const updateChannel = (name: string, data: any) => api.put(`/channels/${name}`, data);
export const deleteChannel = (name: string) => api.delete(`/channels/${name}`);
export const testChannel = (name: string) => api.post(`/channels/${name}/test`);

// WhatsApp
export const startWhatsAppAuth = () => api.post('/whatsapp/auth/start');
export const getWhatsAppAuthStatus = () => api.get('/whatsapp/auth/status');
export const cancelWhatsAppAuth = () => api.post('/whatsapp/auth/cancel');
