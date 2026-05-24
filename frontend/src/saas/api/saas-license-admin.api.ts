import { saasApi } from '@/saas/api/saas-client';
import type { LicenseDeviceRow, LicenseSubscriptionRow } from '@/saas/types';

export type GlobalActivationCodeRow = {
  id: string;
  status: string;
  label: string | null;
  maxUses: number;
  usedCount: number;
  validUntil: string;
  createdAt: string;
  revokedAt: string | null;
  clientId: string;
  client: { businessName: string };
  plan: { name: string; code: string };
};

export type GlobalActivationCodesPage = {
  data: GlobalActivationCodeRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export async function fetchLicenseSubscriptions(): Promise<LicenseSubscriptionRow[]> {
  const { data } = await saasApi.get<LicenseSubscriptionRow[]>('/saas/license-admin/subscriptions');
  return data;
}

export async function fetchLicenseDevices(): Promise<LicenseDeviceRow[]> {
  const { data } = await saasApi.get<LicenseDeviceRow[]>('/saas/license-admin/devices');
  return data;
}

export async function deactivateLicenseDevice(id: string): Promise<LicenseDeviceRow> {
  const { data } = await saasApi.post<LicenseDeviceRow>(`/saas/license-admin/devices/${id}/deactivate`);
  return data;
}

export async function fetchAllActivationCodes(params?: {
  page?: number;
  limit?: number;
  status?: string;
  clientId?: string;
  q?: string;
}): Promise<GlobalActivationCodesPage> {
  const { data } = await saasApi.get<GlobalActivationCodesPage>('/saas/activation-codes', { params });
  return data;
}
