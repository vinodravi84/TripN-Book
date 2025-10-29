// src/services/api.js
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API_URL = `${API_BASE}/api`;

// default axios instance exported as default
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// request interceptor to attach token from localStorage (fallback)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err)
);

// helper to set token programmatically (call from AuthContext)
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('authToken', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('authToken');
  }
};

// Named helpers for auth flows (keeps backward compatibility)
export const registerUser = async (data) => {
  try {
    const res = await api.post('/auth/register', data);
    return res.data; // { user, token }
  } catch (err) {
    // normalize thrown error
    throw err.response?.data || err;
  }
};

export const loginUser = async (data) => {
  try {
    const res = await api.post('/auth/login', data);
    return res.data; // { user, token }
  } catch (err) {
    throw err.response?.data || err;
  }
};

// export default axios instance so existing imports `import api from '../services/api'` work
export default api;
