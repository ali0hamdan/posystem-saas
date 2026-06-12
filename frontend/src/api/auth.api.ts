import { api, saveRefreshToken, clearRefreshToken } from '@/api/client';
import type { LoginResponse, MeResponse } from '@/types/auth';

export type LoginBody = {
  email: string;
  password: string;
  /** Tenant slug (optional — required if email exists on multiple stores). */
  clientSlug?: string;
};

export async function login(body: LoginBody): Promise<LoginResponse> {
  const payload = {
    email: body.email.trim().toLowerCase(),
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

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/auth/forgot-password', {
    email: email.trim().toLowerCase(),
  });
  return data;
}

export async function resetPassword(body: {
  email: string;
  otp: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post<{ success: boolean; message: string }>('/auth/reset-password', {
    email: body.email.trim().toLowerCase(),
    otp: body.otp,
    newPassword: body.newPassword,
  });
  return data;
}

export { getApiErrorMessage } from '@/api/client';
