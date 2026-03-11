import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
});

api.interceptors.request.use(async config => {
  const token = await SecureStore.getItemAsync('sf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res.data,
  async err => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('sf_token');
    }
    return Promise.reject(err.response?.data || err);
  }
);

export default api;