import axios, { type AxiosError } from 'axios';
import { API_URL } from '@/lib/env';
import { getApiErrorMessage } from '@/api/client';
import { isSaasAccessToken } from '@/lib/saas-auth';
import { useSaasAuthStore } from '@/saas/stores/saas-auth-store';
import { SAAS_ADMIN_API_PREFIX, rewriteSaasApiUrl } from '@/saas/config/saas-paths';

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
  // Rewrite the well-known `/saas/...` path prefix to whatever
  // `VITE_SUPER_ADMIN_API_PREFIX` is configured to. No-op when the env is
  // unset or equal to the default. The individual API files keep their
  // literal `/saas/...` strings so they're easy to grep; this interceptor
  // is the single point that translates to the deployed prefix.
  if (config.url) {
    config.url = rewriteSaasApiUrl(config.url);
  }
  return config;
});

function isSaasLoginRequest(config: AxiosError['config']): boolean {
  if (!config?.url) return false;
  const method = config.method?.toLowerCase() ?? 'get';
  const url = config.url.toLowerCase();
  // Accept BOTH the legacy `/saas/auth/login` literal AND the rewritten
  // prefixed URL, since this check may run before or after the rewriter
  // depending on axios internals.
  return (
    method === 'post' &&
    (url.includes('/saas/auth/login') ||
      url.includes(`${SAAS_ADMIN_API_PREFIX.toLowerCase()}/auth/login`))
  );
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
