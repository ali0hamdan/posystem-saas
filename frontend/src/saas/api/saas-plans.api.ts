import { saasApi } from '@/saas/api/saas-client';
import type { CreateSaasPlanBody, PatchSaasPlanBody, SaasPlan } from '@/saas/types';

export async function fetchSaasPlans(): Promise<SaasPlan[]> {
  const { data } = await saasApi.get<SaasPlan[]>('/saas/plans');
  return data;
}

export async function createSaasPlan(body: CreateSaasPlanBody): Promise<SaasPlan> {
  const { data } = await saasApi.post<SaasPlan>('/saas/plans', body);
  return data;
}

export async function patchSaasPlan(id: string, body: PatchSaasPlanBody): Promise<SaasPlan> {
  const { data } = await saasApi.patch<SaasPlan>(`/saas/plans/${id}`, body);
  return data;
}
