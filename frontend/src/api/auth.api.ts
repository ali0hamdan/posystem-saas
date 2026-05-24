import { api, saveRefreshToken, clearRefreshToken } from '@/api/client';
import type { LoginResponse, MeResponse } from '@/types/auth';

export type LoginBody = {
  username: string;
  password: string;
  /** Tenant slug (recommended after device activation). */
  clientSlug?: string;
};

export async function login(body: LoginBody): Promise<LoginResponse> {
  const payload = {
    username: body.username.trim(),
    password: body.password,
    ...(body.clientSlug?.trim() ? { clientSlug: body.clientSlug.trim().toLowerCase() } : {}),
  };
  const { data } = await api.post<LoginResponse>('/auth/login', payload);
  if (data.refreshToken) {
    saveRefreshToken(data.refreshToken);
  }
  return data;
}

export async function fetchMe(opts?: { signal?: AbortSignal }): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/auth/me', { signal: opts?.signal, timeout: 15_000 });
  return data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
  clearRefreshToken();
}
