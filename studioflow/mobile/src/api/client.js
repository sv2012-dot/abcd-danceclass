import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const PROD_API = 'https://abcd-danceclass-production.up.railway.app/api';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || PROD_API,
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
