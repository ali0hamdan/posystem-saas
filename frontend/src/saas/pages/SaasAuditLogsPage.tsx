import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { TextInput, FieldLabel, SelectInput } from '@/components/ui/input';
import { DataTable, DataTableShell, Td, Th } from '@/components/ui/data-table';
import { SaasQueryError, SaasEmptyTable, SaasTableSkeleton } from '@/saas/components/SaasQueryState';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { fetchAuditLogs } from '@/saas/api/saas-audit-logs.api';
import { saasFormFieldClass } from '@/saas/lib/form-styles';

const ENTITY_OPTIONS = ['', 'Client', 'User', 'Subscription', 'ActivationCode', 'Plan', 'Device'];

export function SaasAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');

  const logsQ = useQuery({
    queryKey: ['saas', 'audit-logs', { page, action, entity }],
    queryFn: () =>
      fetchAuditLogs({
        page,
        limit: 50,
        action: action.trim() || undefined,
        entity: entity || undefined,
      }),
  });

  function resetFilters() {
    setAction('');
    setEntity('');
    setPage(1);
  }

  const rows = logsQ.data?.data ?? [];
  const meta = logsQ.data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit logs"
        description="Platform operator actions and tenant changes."
      />

      <div className="flex flex-wrap gap-4 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="min-w-[200px] flex-1">
          <FieldLabel htmlFor="al-action">Action contains</FieldLabel>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <TextInput
              id="al-action"
              className={`pl-9 ${saasFormFieldClass}`}
              placeholder="saas.clients.create…"
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="w-44">
          <FieldLabel htmlFor="al-entity">Entity</FieldLabel>
          <SelectInput
            id="al-entity"
            className={saasFormFieldClass}
            value={entity}
            onChange={(e) => { setEntity(e.target.value); setPage(1); }}
          >
            {ENTITY_OPTIONS.map((o) => (
              <option key={o} value={o}>{o || 'All entities'}</option>
            ))}
          </SelectInput>
        </div>
        {(action || entity) && (
          <div className="flex items-end">
            <Button variant="secondary" size="sm" onClick={resetFilters}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {logsQ.isLoading ? <SaasTableSkeleton /> : null}
      {logsQ.isError ? (
        <SaasQueryError message={getSaasApiErrorMessage(logsQ.error)} onRetry={() => logsQ.refetch()} />
      ) : null}

      {logsQ.isSuccess ? (
        rows.length === 0 ? (
          <SaasEmptyTable title="No audit events found" description="Try changing the filters." />
        ) : (
          <DataTableShell minWidthClass="min-w-[900px]">
            <DataTable>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Client</Th>
                  <Th>User</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((log) => (
                  <tr key={log.id}>
                    <Td className="whitespace-nowrap text-ink-muted text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </Td>
                    <Td className="font-mono text-xs">{log.action}</Td>
                    <Td className="text-xs">
                      <span className="font-medium">{log.entity}</span>
                      {log.entityId && (
                        <span className="ml-1 text-ink-faint font-mono">{log.entityId.slice(0, 8)}…</span>
                      )}
                    </Td>
                    <Td>
                      {log.client && log.clientId ? (
                        <Link
                          to={`/saas/clients/${log.clientId}`}
                          className="text-xs text-primary-400 hover:underline"
                        >
                          {log.client.businessName}
                        </Link>
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td className="text-xs text-ink-muted">
                      {log.user?.username ?? (log.userId ? log.userId.slice(0, 8) + '…' : '—')}
                    </Td>
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
            Page {meta.page} of {meta.totalPages} ({meta.total} events)
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
    </div>
  );
}
