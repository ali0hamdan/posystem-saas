import { saasApi } from '@/saas/api/saas-client';
import type { SaasLoginResponse, SaasMeResponse } from '@/saas/types';

export async function saasLogin(body: { email: string; password: string }): Promise<SaasLoginResponse> {
  const { data } = await saasApi.post<SaasLoginResponse>('/saas/auth/login', body);
  return data;
}

export async function saasFetchMe(opts?: { signal?: AbortSignal }): Promise<SaasMeResponse> {
  const { data } = await saasApi.get<SaasMeResponse>('/saas/auth/me', { signal: opts?.signal, timeout: 15_000 });
  return data;
}

export async function saasLogout(): Promise<void> {
  await saasApi.post('/saas/auth/logout');
}
