import axios, { type AxiosError } from 'axios';
import { API_URL } from '@/lib/env';
import { getApiErrorMessage } from '@/api/client';
import { isSaasAccessToken } from '@/lib/saas-auth';
import { useSaasAuthStore } from '@/saas/stores/saas-auth-store';

export const saasApi = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

saasApi.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  config.headers['X-Request-Id'] = crypto.randomUUID();
  delete config.headers.Authorization;
  const token = useSaasAuthStore.getState().accessToken;
  if (isSaasAccessToken(token)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function isSaasLoginRequest(config: AxiosError['config']): boolean {
  if (!config?.url) return false;
  const method = config.method?.toLowerCase() ?? 'get';
  return method === 'post' && config.url.toLowerCase().includes('/saas/auth/login');
}

saasApi.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !isSaasLoginRequest(error.config)) {
      useSaasAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  },
);

export function getSaasApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  return getApiErrorMessage(error, fallback);
}
