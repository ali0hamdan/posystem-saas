import { api } from '@/api/client';
import type { TenantContext } from '@/types/tenant-context';

export async function fetchTenantContext(): Promise<TenantContext> {
  const { data } = await api.get<TenantContext>('/tenant/context');
  return data;
}
