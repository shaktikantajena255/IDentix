import axios from 'axios';

const api = axios.create({
  baseURL: '',
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
