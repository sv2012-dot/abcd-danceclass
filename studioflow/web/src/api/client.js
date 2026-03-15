import axios from 'axios';

const PROD_API = 'https://abcd-danceclass-production.up.railway.app/api';
const API_URL = process.env.REACT_APP_API_URL
  || (process.env.NODE_ENV === 'production' ? PROD_API : 'http://localhost:5000/api');

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('sf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sf_token');
      localStorage.removeItem('sf_user');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  }
);

export default api;