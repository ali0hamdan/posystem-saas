import { api } from '@/api/client';
import type { UserRole } from '@/types/auth';

export type RoleMeta = {
  role: UserRole;
  description: string;
  permissions: string[];
};

export async function fetchRoleMeta(): Promise<RoleMeta[]> {
  const { data } = await api.get<RoleMeta[]>('/permissions/roles');
  return data;
}
