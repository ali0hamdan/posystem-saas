import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL, BYPASS_LICENSE } from '@/lib/env';
import { logApiResponseError, getRequestIdFromError } from '@/lib/frontend-logger';
import { getStoreAccessToken } from '@/lib/store-auth';
import { useAuthStore } from '@/stores/auth-store';
import { useBranchStore } from '@/stores/branch-store';
import { useLicenseStore } from '@/stores/license-store';

const REFRESH_TOKEN_KEY = 'pos_refresh_token';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
  timeout: 10_000,
});

api.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  config.headers['X-Request-Id'] = crypto.randomUUID();
  delete config.headers.Authorization;

  const token = getStoreAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const branchId = useBranchStore.getState().selectedBranchId;
  if (branchId) {
    config.headers['X-Branch-Id'] = branchId;
  }
  if (!BYPASS_LICENSE) {
    const lic = useLicenseStore.getState().token?.trim();
    if (lic) {
      config.headers['X-License-Token'] = lic;
    }
  }
  return config;
});

export function saveRefreshToken(token: string) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
export function clearRefreshToken() {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function isAuthLoginRequest(config: AxiosError['config']): boolean {
  if (!config?.url) return false;
  const method = config.method?.toLowerCase() ?? 'get';
  const path = config.url.toLowerCase();
  return method === 'post' && path.includes('/auth/login');
}

function isRefreshRequest(config: AxiosError['config']): boolean {
  return config?.url?.includes('/auth/refresh') ?? false;
}

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

async function attemptTokenRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${API_URL}/auth/refresh`,
      { refreshToken },
    );
    useAuthStore.getState().setSession(
      data.accessToken,
      useAuthStore.getState().user!,
    );
    saveRefreshToken(data.refreshToken);
    return data.accessToken;
  } catch {
    clearRefreshToken();
    useAuthStore.getState().clearAuth();
    return null;
  }
}

/** Nest `code` from HTTP error body (e.g. `INSUFFICIENT_STOCK`), if present. */
export function getAxiosErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const data = error.response?.data as { code?: unknown } | undefined;
  const code = data?.code;
  return typeof code === 'string' && code.trim() ? code.trim() : undefined;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    logApiResponseError(error);
    if (
      error.response?.status === 401 &&
      !isAuthLoginRequest(error.config) &&
      !isRefreshRequest(error.config)
    ) {
      const code = getAxiosErrorCode(error);
      if (code?.startsWith('LICENSE_')) {
        const msg = (error.response?.data as { message?: string } | undefined)?.message;
        useLicenseStore.getState().setLock(
          typeof msg === 'string' && msg.trim() ? msg.trim() : 'License is not valid for this deployment.',
        );
        return Promise.reject(error);
      }

      // Attempt silent token refresh
      const originalConfig = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      if (!originalConfig._retry) {
        originalConfig._retry = true;
        if (isRefreshing) {
          return new Promise<string>((resolve) => {
            refreshQueue.push(resolve);
          }).then((newToken) => {
            originalConfig.headers.Authorization = `Bearer ${newToken}`;
            return api(originalConfig);
          });
        }
        isRefreshing = true;
        const newToken = await attemptTokenRefresh();
        isRefreshing = false;
        if (newToken) {
          refreshQueue.forEach((cb) => cb(newToken));
          refreshQueue = [];
          originalConfig.headers.Authorization = `Bearer ${newToken}`;
          return api(originalConfig);
        }
        refreshQueue = [];
        useAuthStore.getState().clearAuth();
      }
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    const msg = data?.message;
    let text: string | undefined;
    if (typeof msg === 'string' && msg.trim()) {
      text = msg;
    } else if (Array.isArray(msg) && msg.length > 0 && typeof msg[0] === 'string') {
      text = msg[0];
    }
    const rid = getRequestIdFromError(error);
    if (text && rid) {
      return `${text} (support ref: ${rid})`;
    }
    if (text) {
      return text;
    }
    if (rid) {
      return `${fallback} (support ref: ${rid})`;
    }
  }
  return fallback;
}

export { getRequestIdFromError } from '@/lib/frontend-logger';

