import axios from 'axios';

// In development: empty string — Vite proxy handles /api/* → localhost:8000
// In production (Vercel etc.): set VITE_API_URL=https://your-backend.railway.app
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('identix_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('identix_token');
      localStorage.removeItem('identix_officer');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
