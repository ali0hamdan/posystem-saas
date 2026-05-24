import { api } from '@/api/client';
import type { BranchSummary } from '@/types/auth';

export type BranchDetail = BranchSummary & {
  address: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchBranches(): Promise<BranchSummary[]> {
  const { data } = await api.get<BranchSummary[]>('/branches');
  return data;
}

export type CreateBranchBody = {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
};

export async function createBranch(body: CreateBranchBody): Promise<BranchDetail> {
  const { data } = await api.post<BranchDetail>('/branches', body);
  return data;
}

export type UpdateBranchBody = Partial<CreateBranchBody>;

export async function updateBranch(id: string, body: UpdateBranchBody): Promise<BranchDetail> {
  const { data } = await api.patch<BranchDetail>(`/branches/${id}`, body);
  return data;
}
