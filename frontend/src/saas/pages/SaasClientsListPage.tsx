import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { TextInput, SelectInput, FieldLabel } from '@/components/ui/input';
import { DataTable, DataTableShell, Td, Th } from '@/components/ui/data-table';
import { fetchSaasClients } from '@/saas/api/saas-clients.api';
import { fetchLicenseSubscriptions } from '@/saas/api/saas-license-admin.api';
import { subscriptionByClientId, daysUntil } from '@/saas/lib/dashboard-stats';
import { SaasStatusBadge } from '@/saas/components/SaasStatusBadge';
import { SaasQueryError, SaasEmptyTable, SaasTableSkeleton } from '@/saas/components/SaasQueryState';
import { CreateClientModal } from '@/saas/components/CreateClientModal';
import { useSaasPermissions } from '@/saas/hooks/use-saas-permissions';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { formatSaasDate } from '@/saas/lib/format-date';
import { saasFormFieldClass } from '@/saas/lib/form-styles';
import type { ClientStatus, LicensePlanCode } from '@/saas/types';

type Mode = 'all' | 'suspended' | 'expiring' | 'pending';

export function SaasClientsListPage({ mode = 'all' }: { mode?: Mode }) {
  const navigate = useNavigate();
  const perms = useSaasPermissions();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<ClientStatus | ''>('');
  const [planFilter, setPlanFilter] = useState<LicensePlanCode | ''>('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const modeStatus =
    mode === 'suspended' ? 'SUSPENDED' :
    mode === 'pending' ? 'PENDING_PAYMENT' :
    status || undefined;

  const listQ = useQuery({
    queryKey: ['saas', 'clients', { page, q, status: modeStatus, mode }],
    queryFn: () =>
      fetchSaasClients({
        page,
        limit: 20,
        q: q.trim() || undefined,
        status: modeStatus as ClientStatus | undefined,
      }),
  });

  const subsQ = useQuery({ queryKey: ['saas', 'subscriptions'], queryFn: fetchLicenseSubscriptions });
  const subMap = useMemo(() => subscriptionByClientId(subsQ.data ?? []), [subsQ.data]);

  const rows = useMemo(() => {
    const data = listQ.data?.data ?? [];
    if (mode !== 'expiring') return data;
    return data.filter((c) => {
      const sub = subMap.get(c.id);
      if (!sub || sub.status !== 'ACTIVE') return false;
      const d = daysUntil(sub.expiresAt);
      return d >= 0 && d <= 30;
    });
  }, [listQ.data, mode, subMap]);

  const title =
    mode === 'suspended' ? 'Suspended clients' :
    mode === 'expiring' ? 'Expiring soon' :
    mode === 'pending' ? 'Pending payment' :
    'Clients';

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description="Manage POS tenants, subscriptions, and onboarding."
        actions={
          perms.canCreateClient ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create client
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-4 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="min-w-[200px] flex-1">
          <FieldLabel htmlFor="cl-q">Search</FieldLabel>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <TextInput
              id="cl-q"
              className={`pl-9 ${saasFormFieldClass}`}
              placeholder="Business, owner, email…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        {mode === 'all' ? (
          <div className="w-40">
            <FieldLabel htmlFor="cl-st">Status</FieldLabel>
            <SelectInput
              id="cl-st"
              className={saasFormFieldClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ClientStatus | '');
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_PAYMENT">Pending payment</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="INACTIVE">Inactive</option>
            </SelectInput>
          </div>
        ) : null}
        <div className="w-40">
          <FieldLabel htmlFor="cl-pl">Plan</FieldLabel>
          <SelectInput
            id="cl-pl"
            className={saasFormFieldClass}
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as LicensePlanCode | '')}
          >
            <option value="">All plans</option>
            <option value="STARTER">Starter</option>
            <option value="BUSINESS">Business</option>
            <option value="PRO">Pro</option>
            <option value="LIFETIME_DESKTOP">Lifetime</option>
          </SelectInput>
        </div>
      </div>

      {listQ.isLoading ? <SaasTableSkeleton /> : null}
      {listQ.isError ? (
        <SaasQueryError message={getSaasApiErrorMessage(listQ.error)} onRetry={() => listQ.refetch()} />
      ) : null}

      {listQ.isSuccess ? (
        rows.length === 0 ? (
          <SaasEmptyTable title="No clients found" description="Try adjusting filters or create a new client." />
        ) : (
          <DataTableShell minWidthClass="min-w-[1000px]">
            <DataTable>
              <thead>
                <tr>
                  <Th>Business</Th>
                  <Th>Owner</Th>
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th>Plan</Th>
                  <Th>Expiry</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((c) => {
                    if (!planFilter) return true;
                    return subMap.get(c.id)?.plan.code === planFilter;
                  })
                  .map((c) => {
                    const sub = subMap.get(c.id);
                    return (
                      <tr key={c.id} className="hover:bg-canvas">
                        <Td className="font-medium text-ink">{c.businessName}</Td>
                        <Td className="text-ink-muted">{c.ownerName}</Td>
                        <Td className="text-ink-muted">{c.email}</Td>
                        <Td>
                          <SaasStatusBadge status={c.status} />
                        </Td>
                        <Td className="text-ink">{sub?.plan.name ?? '—'}</Td>
                        <Td className="text-ink">{sub ? formatSaasDate(sub.expiresAt) : '—'}</Td>
                        <Td>
                          <Link
                            to={`/saas/clients/${c.id}`}
                            className="text-sm font-medium text-primary-500 hover:underline"
                          >
                            Open
                          </Link>
                        </Td>
                      </tr>
                    );
                  })}
              </tbody>
            </DataTable>
          </DataTableShell>
        )
      ) : null}

      {listQ.data?.meta && mode === 'all' ? (
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>
            Page {listQ.data.meta.page} of {listQ.data.meta.totalPages} ({listQ.data.meta.total} total)
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= listQ.data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <CreateClientModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => navigate(`/saas/clients/${id}`)}
      />
    </div>
  );
}

