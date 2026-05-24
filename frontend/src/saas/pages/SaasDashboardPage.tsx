import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2, Clock, Monitor, Users, UserPlus, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable, DataTableShell, Td, Th } from '@/components/ui/data-table';
import { fetchSaasClients } from '@/saas/api/saas-clients.api';
import { fetchLicenseDevices, fetchLicenseSubscriptions } from '@/saas/api/saas-license-admin.api';
import { computeDashboardStats, daysUntil, subscriptionByClientId } from '@/saas/lib/dashboard-stats';
import { SaasQueryError, SaasTableSkeleton } from '@/saas/components/SaasQueryState';
import { SaasCard } from '@/saas/components/SaasCard';
import { SaasStatusBadge } from '@/saas/components/SaasStatusBadge';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { formatSaasDate } from '@/saas/lib/format-date';

export function SaasDashboardPage() {
  const clientsQ = useQuery({
    queryKey: ['saas', 'clients', 'dashboard'],
    queryFn: () => fetchSaasClients({ page: 1, limit: 100 }),
  });
  const subsQ = useQuery({ queryKey: ['saas', 'subscriptions'], queryFn: fetchLicenseSubscriptions });
  const devicesQ = useQuery({ queryKey: ['saas', 'devices'], queryFn: fetchLicenseDevices });

  const stats = useMemo(() => {
    if (!clientsQ.data) return null;
    return computeDashboardStats(
      clientsQ.data.data,
      subsQ.data ?? [],
      devicesQ.data ?? [],
    );
  }, [clientsQ.data, subsQ.data, devicesQ.data]);

  const expiring = useMemo(() => {
    const subs = subsQ.data ?? [];
    const now = Date.now();
    return subs
      .filter((s) => s.status === 'ACTIVE' && new Date(s.expiresAt).getTime() > now)
      .filter((s) => daysUntil(s.expiresAt) <= 30)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
      .slice(0, 8);
  }, [subsQ.data]);

  const recentClients = clientsQ.data?.data.slice(0, 8) ?? [];
  const subMap = useMemo(() => subscriptionByClientId(subsQ.data ?? []), [subsQ.data]);

  const loading = clientsQ.isLoading || subsQ.isLoading;
  const error = clientsQ.isError ? clientsQ.error : subsQ.isError ? subsQ.error : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform dashboard"
        description="Overview of tenants, subscriptions, and devices across your POS network."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : null}

      {error ? (
        <SaasQueryError
          message={getSaasApiErrorMessage(error)}
          onRetry={() => {
            void clientsQ.refetch();
            void subsQ.refetch();
          }}
        />
      ) : null}

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard title="Total clients" value={String(stats.totalClients)} icon={Building2} />
          <StatCard title="Active clients" value={String(stats.activeClients)} icon={Users} />
          <StatCard title="Suspended" value={String(stats.suspendedClients)} icon={AlertTriangle} />
          <Link to="/saas/clients/pending" className="block">
            <StatCard title="Pending payment" value={String(stats.pendingPayment)} icon={Clock} />
          </Link>
          <StatCard title="Expired subs" value={String(stats.expiredSubscriptions)} icon={Clock} />
          <StatCard title="Devices active" value={String(stats.devicesActivated)} icon={Monitor} />
          <StatCard title="Expiring soon" value={String(stats.expiringSoon)} icon={Clock} subtitle="Within 30 days" />
          <StatCard title="New this month" value={String(stats.newThisMonth)} icon={UserPlus} />
          <StatCard title="Recent activations" value={String(stats.recentActivations)} icon={Monitor} subtitle="Last 7 days" />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <SaasCard title="Recent clients" action={<Link to="/saas/clients" className="text-xs text-primary-400 hover:underline">View all</Link>}>
          {clientsQ.isLoading ? <SaasTableSkeleton rows={4} /> : (
            <DataTableShell minWidthClass="min-w-[480px]">
              <DataTable>
                <thead>
                  <tr>
                    <Th>Business</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentClients.map((c) => (
                    <tr key={c.id} className="hover:bg-canvas">
                      <Td>
                        <Link to={`/saas/clients/${c.id}`} className="font-medium text-primary-400 hover:underline">
                          {c.businessName}
                        </Link>
                      </Td>
                      <Td>
                        <SaasStatusBadge status={c.status} />
                      </Td>
                      <Td className="text-ink-muted">{formatSaasDate(c.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </DataTableShell>
          )}
        </SaasCard>

        <SaasCard title="Expiring subscriptions" action={<Link to="/saas/clients/expiring" className="text-xs text-primary-400 hover:underline">View all</Link>}>
          {subsQ.isLoading ? <SaasTableSkeleton rows={4} /> : expiring.length === 0 ? (
            <p className="text-sm text-ink-muted">No subscriptions expiring in the next 30 days.</p>
          ) : (
            <DataTableShell minWidthClass="min-w-[480px]">
              <DataTable>
                <thead>
                  <tr>
                    <Th>Client</Th>
                    <Th>Plan</Th>
                    <Th>Expires</Th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.map((s) => (
                    <tr key={s.id}>
                      <Td>
                        <Link to={`/saas/clients/${s.clientId}/subscription`} className="text-primary-400 hover:underline">
                          {s.client.businessName}
                        </Link>
                      </Td>
                      <Td className="text-ink">{s.plan.name}</Td>
                      <Td className="text-ink-muted">
                        {formatSaasDate(s.expiresAt)} ({daysUntil(s.expiresAt)}d)
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </DataTableShell>
          )}
        </SaasCard>
      </div>

      <SaasCard title="Recent clients with plan">
        <DataTableShell>
          <DataTable>
            <thead>
              <tr>
                <Th>Business</Th>
                <Th>Plan</Th>
                <Th>Expiry</Th>
              </tr>
            </thead>
            <tbody>
              {recentClients.map((c) => {
                const sub = subMap.get(c.id);
                return (
                  <tr key={c.id}>
                    <Td>
                      <Link to={`/saas/clients/${c.id}`} className="text-primary-400 hover:underline">
                        {c.businessName}
                      </Link>
                    </Td>
                    <Td>{sub?.plan.name ?? '—'}</Td>
                    <Td>{sub ? formatSaasDate(sub.expiresAt) : '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </DataTableShell>
      </SaasCard>

      <SaasCard title="Audit logs">
        <p className="text-sm text-ink-muted">
          {/* TODO: GET /saas/audit-logs not implemented on backend */}
          Audit log API is not available yet. Events are recorded server-side; a read API will be added in a future release.
        </p>
        <Link to="/saas/audit-logs" className="mt-3 inline-block text-sm text-primary-400 hover:underline">
          Go to audit logs →
        </Link>
      </SaasCard>
    </div>
  );
}

