import type { LicenseDeviceRow, LicenseSubscriptionRow, SaasClientSummary } from '@/saas/types';

const MS_DAY = 86_400_000;

export type DashboardStats = {
  totalClients: number;
  activeClients: number;
  suspendedClients: number;
  pendingPayment: number;
  expiredSubscriptions: number;
  devicesActivated: number;
  expiringSoon: number;
  newThisMonth: number;
  recentActivations: number;
};

export function computeDashboardStats(
  clients: SaasClientSummary[],
  subscriptions: LicenseSubscriptionRow[],
  devices: LicenseDeviceRow[],
): DashboardStats {
  const now = Date.now();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const activeClients = clients.filter((c) => c.status === 'ACTIVE').length;
  const suspendedClients = clients.filter((c) => c.status === 'SUSPENDED').length;
  const pendingPayment = clients.filter((c) => c.status === 'PENDING_PAYMENT').length;

  const expiredSubscriptions = subscriptions.filter((s) => {
    const exp = new Date(s.expiresAt).getTime();
    return s.status === 'EXPIRED' || (s.status === 'ACTIVE' && exp < now);
  }).length;

  const expiringSoon = subscriptions.filter((s) => {
    if (s.status !== 'ACTIVE') return false;
    const exp = new Date(s.expiresAt).getTime();
    const days = (exp - now) / MS_DAY;
    return days >= 0 && days <= 30;
  }).length;

  const devicesActivated = devices.filter((d) => d.isActive).length;

  const newThisMonth = clients.filter((c) => new Date(c.createdAt) >= monthStart).length;

  const weekAgo = now - 7 * MS_DAY;
  const recentActivations = devices.filter((d) => new Date(d.createdAt).getTime() >= weekAgo).length;

  return {
    totalClients: clients.length,
    activeClients,
    suspendedClients,
    pendingPayment,
    expiredSubscriptions,
    devicesActivated,
    expiringSoon,
    newThisMonth,
    recentActivations,
  };
}

export function subscriptionByClientId(
  subscriptions: LicenseSubscriptionRow[],
): Map<string, LicenseSubscriptionRow> {
  const map = new Map<string, LicenseSubscriptionRow>();
  for (const s of subscriptions) {
    const existing = map.get(s.clientId);
    if (!existing) {
      map.set(s.clientId, s);
      continue;
    }
    const a = new Date(s.expiresAt).getTime();
    const b = new Date(existing.expiresAt).getTime();
    if (a > b) map.set(s.clientId, s);
  }
  return map;
}

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / MS_DAY);
}
