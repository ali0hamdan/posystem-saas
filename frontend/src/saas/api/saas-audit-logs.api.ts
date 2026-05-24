import { saasApi } from '@/saas/api/saas-client';

export type AuditLogRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  clientId: string | null;
  userId: string | null;
  client: { businessName: string } | null;
  user: { username: string } | null;
};

export type AuditLogPage = {
  data: AuditLogRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type ListAuditLogsParams = {
  page?: number;
  limit?: number;
  clientId?: string;
  action?: string;
  entity?: string;
};

export async function fetchAuditLogs(params?: ListAuditLogsParams): Promise<AuditLogPage> {
  const { data } = await saasApi.get<AuditLogPage>('/saas/audit-logs', { params });
  return data;
}
