import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE;
export const SIMULATOR_URL = import.meta.env.VITE_SIMULATOR_URL;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error(`[API ${error.config?.method?.toUpperCase()} ${error.config?.url}]`, error.message);
    return Promise.reject(error);
  }
);

// Eventi
export const getEventi = () => api.get('/api/eventi');
export const createEvento = (data) => api.post('/api/eventi', data);

// Piloti
export const getPiloti = () => api.get('/api/piloti');
export const createPilota = (data) => api.post('/api/piloti', data);
export const deletePilota = (id) => api.delete(`/api/piloti/${id}`);

// Tempi
export const createTempo = (data) => api.post('/api/tempi', data);
export const updateTempo = (id, data) => api.patch(`/api/tempi/${id}`, data);
export const getTempi = () => api.get('/api/tempi');

// Classifiche
export const getClassifiche = () => api.get('/api/classifiche');

export default api;
