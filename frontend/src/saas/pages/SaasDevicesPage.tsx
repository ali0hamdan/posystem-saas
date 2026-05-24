import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, DataTableShell, Td, Th } from '@/components/ui/data-table';
import { fetchLicenseDevices, deactivateLicenseDevice } from '@/saas/api/saas-license-admin.api';
import { SaasStatusBadge } from '@/saas/components/SaasStatusBadge';
import { SaasQueryError, SaasTableSkeleton } from '@/saas/components/SaasQueryState';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { useSaasPermissions } from '@/saas/hooks/use-saas-permissions';
import { formatSaasDateTime } from '@/saas/lib/format-date';


export function SaasDevicesPage() {
  const qc = useQueryClient();
  const perms = useSaasPermissions();
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  const devicesQ = useQuery({ queryKey: ['saas', 'devices'], queryFn: fetchLicenseDevices });

  const deactivateM = useMutation({
    mutationFn: deactivateLicenseDevice,
    onSuccess: () => {
      toast.success('Device deactivated');
      setDeactivateId(null);
      void qc.invalidateQueries({ queryKey: ['saas', 'devices'] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Devices" description="All registered POS devices across tenants." />

      {devicesQ.isLoading ? <SaasTableSkeleton /> : null}
      {devicesQ.isError ? (
        <SaasQueryError message={getSaasApiErrorMessage(devicesQ.error)} onRetry={() => devicesQ.refetch()} />
      ) : null}

      {devicesQ.data ? (
        <DataTableShell minWidthClass="min-w-[900px]">
          <DataTable>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Device</Th>
                <Th>Platform</Th>
                <Th>Status</Th>
                <Th>Last seen</Th>
                <Th>—</Th>
              </tr>
            </thead>
            <tbody>
              {devicesQ.data.map((d) => (
                <tr key={d.id}>
                  <Td>
                    <Link to={`/saas/clients/${d.clientId}`} className="text-primary-400 hover:underline">
                      {d.client.businessName}
                    </Link>
                  </Td>
                  <Td>
                    <div className="font-medium">{d.deviceName ?? '—'}</div>
                    <div className="font-mono text-xs text-ink-faint">{d.deviceId}</div>
                  </Td>
                  <Td>{d.platform ?? '—'}</Td>
                  <Td>
                    <SaasStatusBadge status={d.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </Td>
                  <Td className="text-ink-muted">{formatSaasDateTime(d.lastSeenAt)}</Td>
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
        description="This device will stop syncing until activated again."
        confirmLabel="Deactivate"
        variant="danger"
        loading={deactivateM.isPending}
        onConfirm={() => deactivateId && deactivateM.mutate(deactivateId)}
        onCancel={() => setDeactivateId(null)}
      />
    </div>
  );
}
