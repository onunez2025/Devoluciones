import { Capacitor } from '@capacitor/core';
import axios from 'axios';
import { storageService } from './storageService';

const PROD_URL = 'https://gac-sole-devoluciones.jppsfv.easypanel.host';

const apiClient = axios.create({
  baseURL: Capacitor.isNativePlatform() ? `${PROD_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = storageService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      storageService.clearAll();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
