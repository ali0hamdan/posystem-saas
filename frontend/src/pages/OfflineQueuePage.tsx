import { useCallback, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { posOfflineDb } from '@/offline/pos-db';
import {
  processOfflineSaleSyncQueue,
  resetOfflineQueueEntryForRetry,
} from '@/offline/sync-engine';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, Th, Td } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import type { OfflineSaleQueueRow, SyncAuditLogRow } from '@/offline/pos-db';

function queueBadge(status: OfflineSaleQueueRow['status']) {
  switch (status) {
    case 'pending':
      return <Badge variant="warning">Pending</Badge>;
    case 'syncing':
      return <Badge variant="primary">Syncing</Badge>;
    case 'failed':
      return <Badge variant="danger">Failed</Badge>;
    default:
      return <Badge variant="muted">{status}</Badge>;
  }
}

function auditBadge(outcome: SyncAuditLogRow['outcome']) {
  switch (outcome) {
    case 'success':
      return <Badge variant="success">Success</Badge>;
    case 'failed_rollback':
      return <Badge variant="warning">Failed · stock restored</Badge>;
    default:
      return <Badge variant="danger">Failed</Badge>;
  }
}

export function OfflineQueuePage() {
  const [busy, setBusy] = useState(false);
  const queue = useLiveQuery(() => posOfflineDb.offlineSaleQueue.orderBy('createdAt').reverse().toArray(), [], []);
  const audits = useLiveQuery(() => posOfflineDb.syncAuditLog.orderBy('at').reverse().limit(80).toArray(), [], []);

  const runSync = useCallback(async () => {
    setBusy(true);
    try {
      await processOfflineSaleSyncQueue();
      toast.success('Sync run finished');
    } catch {
      toast.error('Sync failed to start');
    } finally {
      setBusy(false);
    }
  }, []);

  const retryOne = useCallback(async (localId: string) => {
    await resetOfflineQueueEntryForRetry(localId);
    await processOfflineSaleSyncQueue();
    toast.message('Retry queued');
  }, []);

  return (
    <div className="mx-auto max-w-[1200px] space-y-8">
      <PageHeader
        title="Offline sales & sync"
        description="Unsynced POS invoices are stored on this device and posted when the server is reachable. Stock conflicts roll back local quantities for that invoice."
        actions={
          <Button type="button" variant="primary" className="gap-2" disabled={busy} onClick={() => void runSync()}>
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden />
            Sync now
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-base font-semibold text-ink">Unsynced invoices</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Invoice numbers starting with OFF- are local only until sync succeeds; the server assigns the final
              invoice number.
            </p>
          </div>
          {queue.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No queued offline sales" description="Everything is synced, or no offline sales were created yet." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <DataTable className="min-w-[720px]">
                <thead>
                  <tr>
                    <Th>Offline invoice</Th>
                    <Th>Status</Th>
                    <Th>Attempts</Th>
                    <Th>Created</Th>
                    <Th>Error / conflict</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((row) => (
                    <tr key={row.localId} className="border-b border-line">
                      <Td className="font-mono text-sm font-medium">{row.offlineInvoiceNumber}</Td>
                      <Td>{queueBadge(row.status)}</Td>
                      <Td className="tabular-nums">{row.attempts}</Td>
                      <Td className="text-ink-muted">{new Date(row.createdAt).toLocaleString()}</Td>
                      <Td className="max-w-[280px] truncate text-sm text-danger-700" title={row.lastError ?? ''}>
                        {row.conflictCode ? `${row.conflictCode}: ` : ''}
                        {row.lastError ?? '—'}
                      </Td>
                      <Td className="text-right">
                        {row.status === 'failed' ? (
                          <Button type="button" variant="secondary" size="sm" onClick={() => void retryOne(row.localId)}>
                            Retry
                          </Button>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-base font-semibold text-ink">Sync audit log</h2>
            <p className="mt-1 text-sm text-ink-muted">Local record of each sync attempt (stored on this device).</p>
          </div>
          {audits.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No audit entries yet" description="Entries appear after sync attempts complete." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <DataTable className="min-w-[720px]">
                <thead>
                  <tr>
                    <Th>Time</Th>
                    <Th>Outcome</Th>
                    <Th>Offline invoice</Th>
                    <Th>Details</Th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((row) => {
                    let detail = '';
                    try {
                      const j = JSON.parse(row.detailJson) as { message?: string; serverInvoiceNumber?: string };
                      detail = j.serverInvoiceNumber ? `Server: ${j.serverInvoiceNumber}` : (j.message ?? row.detailJson);
                    } catch {
                      detail = row.detailJson;
                    }
                    return (
                      <tr key={row.id} className="border-b border-line">
                        <Td className="whitespace-nowrap text-ink-muted">{new Date(row.at).toLocaleString()}</Td>
                        <Td>{auditBadge(row.outcome)}</Td>
                        <Td className="font-mono text-sm">{row.offlineInvoiceNumber}</Td>
                        <Td className="max-w-md truncate text-sm text-ink-muted" title={detail}>
                          {detail}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
