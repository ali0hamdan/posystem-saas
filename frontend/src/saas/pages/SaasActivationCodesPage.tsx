import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { TextInput, FieldLabel, SelectInput } from '@/components/ui/input';
import { DataTable, DataTableShell, Td, Th } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SaasStatusBadge } from '@/saas/components/SaasStatusBadge';
import { SaasQueryError, SaasEmptyTable, SaasTableSkeleton } from '@/saas/components/SaasQueryState';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { fetchAllActivationCodes } from '@/saas/api/saas-license-admin.api';
import { revokeActivationCode } from '@/saas/api/saas-clients.api';
import { useSaasPermissions } from '@/saas/hooks/use-saas-permissions';
import { formatSaasDate } from '@/saas/lib/format-date';
import { saasFormFieldClass } from '@/saas/lib/form-styles';

const STATUS_OPTIONS = ['', 'UNUSED', 'USED', 'EXPIRED', 'REVOKED'];

export function SaasActivationCodesPage() {
  const qc = useQueryClient();
  const perms = useSaasPermissions();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const codesQ = useQuery({
    queryKey: ['saas', 'activation-codes', { page, q, status }],
    queryFn: () =>
      fetchAllActivationCodes({
        page,
        limit: 50,
        q: q.trim() || undefined,
        status: status || undefined,
      }),
  });

  const revokeM = useMutation({
    mutationFn: revokeActivationCode,
    onSuccess: () => {
      toast.success('Code revoked');
      setRevokeId(null);
      void qc.invalidateQueries({ queryKey: ['saas', 'activation-codes'] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e)),
  });

  const rows = codesQ.data?.data ?? [];
  const meta = codesQ.data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activation codes"
        description="All activation codes across tenants. Generate per-client codes from each client's activation tab."
      />

      <div className="flex flex-wrap gap-4 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="min-w-[200px] flex-1">
          <FieldLabel htmlFor="ac-q">Search by client</FieldLabel>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <TextInput
              id="ac-q"
              className={`pl-9 ${saasFormFieldClass}`}
              placeholder="Business name…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="w-40">
          <FieldLabel htmlFor="ac-st">Status</FieldLabel>
          <SelectInput
            id="ac-st"
            className={saasFormFieldClass}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o} value={o}>{o || 'All'}</option>
            ))}
          </SelectInput>
        </div>
      </div>

      {codesQ.isLoading ? <SaasTableSkeleton /> : null}
      {codesQ.isError ? (
        <SaasQueryError message={getSaasApiErrorMessage(codesQ.error)} onRetry={() => codesQ.refetch()} />
      ) : null}

      {codesQ.isSuccess ? (
        rows.length === 0 ? (
          <SaasEmptyTable title="No activation codes found" description="Adjust filters or create codes from a client's activation tab." />
        ) : (
          <DataTableShell minWidthClass="min-w-[960px]">
            <DataTable>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>Plan</Th>
                  <Th>Label</Th>
                  <Th>Status</Th>
                  <Th>Uses</Th>
                  <Th>Valid until</Th>
                  <Th>Created</Th>
                  {perms.canManagePlans ? <Th>—</Th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-canvas">
                    <Td>
                      <Link
                        to={`/saas/clients/${c.clientId}/activation-codes`}
                        className="font-medium text-primary-400 hover:underline"
                      >
                        {c.client.businessName}
                      </Link>
                    </Td>
                    <Td className="text-xs">{c.plan.name}</Td>
                    <Td className="text-xs text-ink-muted">{c.label ?? '—'}</Td>
                    <Td>
                      <SaasStatusBadge status={c.status} />
                    </Td>
                    <Td className="text-xs">
                      {c.usedCount} / {c.maxUses}
                    </Td>
                    <Td className="text-xs text-ink-muted">{formatSaasDate(c.validUntil)}</Td>
                    <Td className="text-xs text-ink-muted">{formatSaasDate(c.createdAt)}</Td>
                    {perms.canManagePlans ? (
                      <Td>
                        {c.status === 'UNUSED' && (
                          <Button variant="ghost" size="sm" onClick={() => setRevokeId(c.id)}>
                            Revoke
                          </Button>
                        )}
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </DataTableShell>
        )
      ) : null}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>
            Page {meta.page} of {meta.totalPages} ({meta.total} total)
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(revokeId)}
        title="Revoke activation code?"
        description="The code will be permanently revoked and cannot be used again."
        confirmLabel="Revoke"
        variant="danger"
        loading={revokeM.isPending}
        onConfirm={() => revokeId && revokeM.mutate(revokeId)}
        onCancel={() => setRevokeId(null)}
      />
    </div>
  );
}
