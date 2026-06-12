import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { TextInput, FieldLabel, SelectInput } from '@/components/ui/input';
import { DataTable, DataTableShell, Td, Th } from '@/components/ui/data-table';
import { fetchLicenseSubscriptions } from '@/saas/api/saas-license-admin.api';
import { SaasStatusBadge } from '@/saas/components/SaasStatusBadge';
import { SaasQueryError, SaasEmptyTable, SaasTableSkeleton } from '@/saas/components/SaasQueryState';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { formatSaasDate } from '@/saas/lib/format-date';
import { daysUntil } from '@/saas/lib/dashboard-stats';
import { saasFormFieldClass } from '@/saas/lib/form-styles';
import type { SubscriptionStatus } from '@/saas/types';

const PAGE_SIZE = 30;

export function SaasSubscriptionsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<SubscriptionStatus | ''>('');
  const [page, setPage] = useState(1);

  const subsQ = useQuery({ queryKey: ['saas', 'subscriptions'], queryFn: fetchLicenseSubscriptions });

  const filtered = useMemo(() => {
    const all = subsQ.data ?? [];
    return all.filter((s) => {
      if (status && s.status !== status) return false;
      if (q) {
        const lower = q.toLowerCase();
        return (
          s.client.businessName.toLowerCase().includes(lower) ||
          s.client.email.toLowerCase().includes(lower) ||
          s.plan.name.toLowerCase().includes(lower)
        );
      }
      return true;
    });
  }, [subsQ.data, q, status]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearch(v: string) {
    setQ(v);
    setPage(1);
  }

  function handleStatus(v: SubscriptionStatus | '') {
    setStatus(v);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" description="All tenant subscriptions across the platform." />

      <div className="flex flex-wrap gap-4 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="min-w-[200px] flex-1">
          <FieldLabel htmlFor="sub-q">Search</FieldLabel>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <TextInput
              id="sub-q"
              className={`pl-9 ${saasFormFieldClass}`}
              placeholder="Business, email, plan…"
              value={q}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="w-40">
          <FieldLabel htmlFor="sub-st">Status</FieldLabel>
          <SelectInput
            id="sub-st"
            className={saasFormFieldClass}
            value={status}
            onChange={(e) => handleStatus(e.target.value as SubscriptionStatus | '')}
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="CANCELLED">Cancelled</option>
          </SelectInput>
        </div>
      </div>

      {subsQ.isLoading ? <SaasTableSkeleton /> : null}
      {subsQ.isError ? (
        <SaasQueryError message={getSaasApiErrorMessage(subsQ.error)} onRetry={() => subsQ.refetch()} />
      ) : null}

      {subsQ.isSuccess ? (
        rows.length === 0 ? (
          <SaasEmptyTable title="No subscriptions found" description="Try adjusting the filters." />
        ) : (
          <DataTableShell minWidthClass="min-w-[960px]">
            <DataTable>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th>Expires</Th>
                  <Th>Days left</Th>
                  <Th>Limits</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const isLifetime = s.status === 'LIFETIME';
                  const days = isLifetime ? null : daysUntil(s.expiresAt);
                  return (
                    <tr key={s.id} className="hover:bg-canvas">
                      <Td>
                        <Link
                          to={`/saas/clients/${s.clientId}/subscription`}
                          className="font-medium text-primary-400 hover:underline"
                        >
                          {s.client.businessName}
                        </Link>
                        <div className="text-xs text-ink-faint">{s.client.email}</div>
                      </Td>
                      <Td>{s.plan.name}</Td>
                      <Td>
                        <SaasStatusBadge status={s.status} />
                      </Td>
                      <Td className="text-ink-muted">
                        {isLifetime ? 'Never (lifetime)' : formatSaasDate(s.expiresAt)}
                      </Td>
                      <Td>
                        {isLifetime ? (
                          <span className="text-ink-muted">∞</span>
                        ) : (
                          <span
                            className={
                              (days as number) < 0
                                ? 'text-danger-600 font-medium'
                                : (days as number) <= 14
                                ? 'text-warning-600 font-medium'
                                : 'text-ink-muted'
                            }
                          >
                            {days}d
                          </span>
                        )}
                      </Td>
                      <Td className="text-xs text-ink-muted">
                        {s.maxUsers ?? '∞'}u · {s.maxBranches ?? '∞'}b · {s.maxDevices ?? '∞'}d
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </DataTableShell>
        )
      ) : null}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>
            Page {page} of {totalPages} ({filtered.length} total)
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
