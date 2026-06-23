import axios from 'axios';
import {
  getAuthToken,
  clearAuthToken,
  applyRotatedTokenFromHeaders,
} from '../auth/accessToken.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

function redirectToAccessDenied() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/access-denied') return;
  window.location.replace('/access-denied');
}

// Request interceptor for auth tokens
apiClient.interceptors.request.use(
  config => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor for error handling and token rotation
apiClient.interceptors.response.use(
  response => {
    applyRotatedTokenFromHeaders(response.headers);
    return response;
  },
  error => {
    if (error.response) {
      applyRotatedTokenFromHeaders(error.response.headers);

      const status = error.response.status;
      if (status === 401) {
        clearAuthToken();
        redirectToAccessDenied();
      } else if (status === 403) {
        redirectToAccessDenied();
      }

      return Promise.reject(error.response.data);
    }

    if (error.request) {
      return Promise.reject({ error: { message: 'Network error. Please try again.' } });
    }

    return Promise.reject({ error: { message: error.message } });
  }
);

export default apiClient;
