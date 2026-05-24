import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { DataTable, DataTableShell, Td, Th } from '@/components/ui/data-table';
import { fetchLicenseDevices, deactivateLicenseDevice } from '@/saas/api/saas-license-admin.api';
import { fetchClientSubscription } from '@/saas/api/saas-clients.api';
import { SaasStatusBadge } from '@/saas/components/SaasStatusBadge';
import { SaasQueryError, SaasEmptyTable, SaasTableSkeleton } from '@/saas/components/SaasQueryState';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { useSaasPermissions } from '@/saas/hooks/use-saas-permissions';
import { formatSaasDateTime } from '@/saas/lib/format-date';
import { useState } from 'react';


export function SaasClientDevicesPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const perms = useSaasPermissions();
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  const devicesQ = useQuery({ queryKey: ['saas', 'devices'], queryFn: fetchLicenseDevices });
  const subQ = useQuery({
    queryKey: ['saas', 'clients', id, 'subscription'],
    queryFn: () => fetchClientSubscription(id),
    enabled: Boolean(id),
  });

  const rows = useMemo(
    () => (devicesQ.data ?? []).filter((d) => d.clientId === id),
    [devicesQ.data, id],
  );

  const deactivateM = useMutation({
    mutationFn: deactivateLicenseDevice,
    onSuccess: () => {
      toast.success('Device deactivated');
      setDeactivateId(null);
      void qc.invalidateQueries({ queryKey: ['saas', 'devices'] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e)),
  });

  const maxDevices = subQ.data?.subscription?.maxDevices;
  const activeCount = rows.filter((d) => d.isActive).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Devices used: <span className="font-medium text-ink">{activeCount}</span>
        {maxDevices != null ? ` / ${maxDevices}` : null}
        {/* TODO: PATCH /saas/devices/:id/status for block/reactivate */}
      </p>

      {devicesQ.isLoading ? <SaasTableSkeleton /> : null}
      {devicesQ.isError ? (
        <SaasQueryError message={getSaasApiErrorMessage(devicesQ.error)} onRetry={() => devicesQ.refetch()} />
      ) : null}

      {devicesQ.isSuccess && rows.length === 0 ? (
        <SaasEmptyTable title="No devices" description="No devices registered for this client yet." />
      ) : null}

      {rows.length > 0 ? (
        <DataTableShell>
          <DataTable>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Device ID</Th>
                <Th>Platform</Th>
                <Th>Status</Th>
                <Th>Last seen</Th>
                <Th>Activated</Th>
                <Th>—</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <Td>{d.deviceName ?? '—'}</Td>
                  <Td className="font-mono text-xs">{d.deviceId}</Td>
                  <Td>{d.platform ?? '—'}</Td>
                  <Td>
                    <SaasStatusBadge status={d.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </Td>
                  <Td className="text-ink-muted">{formatSaasDateTime(d.lastSeenAt)}</Td>
                  <Td className="text-ink-muted">{formatSaasDateTime(d.createdAt)}</Td>
                  <Td>
                    {d.isActive && perms.canDeactivateDevice ? (
                      <Button variant="ghost" size="sm" onClick={() => setDeactivateId(d.id)}>
                        Deactivate
                      </Button>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </DataTableShell>
      ) : null}

      <ConfirmDialog
        open={Boolean(deactivateId)}
        title="Deactivate device?"
        description="The device will no longer be able to sync until re-activated via a new activation."
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={() => deactivateId && deactivateM.mutate(deactivateId)}
        onCancel={() => setDeactivateId(null)}
      />
    </div>
  );
}
