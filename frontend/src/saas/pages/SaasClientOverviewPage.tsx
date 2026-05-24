import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SaasCard } from '@/saas/components/SaasCard';
import { SaasStatusBadge } from '@/saas/components/SaasStatusBadge';
import { fetchSaasClient, reactivateClient, suspendClient } from '@/saas/api/saas-clients.api';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { useSaasPermissions } from '@/saas/hooks/use-saas-permissions';
import { formatSaasDate, formatSaasDateTime } from '@/saas/lib/format-date';
import type { SaasClientDetail } from '@/saas/types';


type Ctx = { clientDetail?: SaasClientDetail };

export function SaasClientOverviewPage() {
  const { id = '' } = useParams();
  const ctx = useOutletContext<Ctx>();
  const qc = useQueryClient();
  const perms = useSaasPermissions();

  const detailQ = useQuery({
    queryKey: ['saas', 'clients', id],
    queryFn: () => fetchSaasClient(id),
    enabled: Boolean(id),
    initialData: ctx.clientDetail,
  });

  const suspendM = useMutation({
    mutationFn: () => suspendClient(id),
    onSuccess: () => {
      toast.success('Client suspended');
      void qc.invalidateQueries({ queryKey: ['saas', 'clients', id] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e)),
  });

  const reactivateM = useMutation({
    mutationFn: () => reactivateClient(id),
    onSuccess: () => {
      toast.success('Client reactivated');
      void qc.invalidateQueries({ queryKey: ['saas', 'clients', id] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e)),
  });

  const d = detailQ.data;
  if (detailQ.isLoading && !d) {
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }
  if (!d) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SaasCard title="Business">
          <dl className="space-y-2 text-sm">
            <Row label="Slug" value={d.client.slug} />
            <Row label="Owner" value={d.client.ownerName} />
            <Row label="Email" value={d.client.email} />
            <Row label="Phone" value={d.client.phone ?? '—'} />
            <Row label="Status" value={<SaasStatusBadge status={d.client.status} />} />
          </dl>
        </SaasCard>

        <SaasCard title="Subscription">
          {d.currentSubscription ? (
            <dl className="space-y-2 text-sm">
              <Row label="Plan" value={d.plan?.name ?? '—'} />
              <Row label="Status" value={<SaasStatusBadge status={d.currentSubscription.status} />} />
              <Row label="Expires" value={formatSaasDate(d.currentSubscription.expiresAt)} />
              <Row label="Max users" value={String(d.currentSubscription.maxUsers)} />
              <Row label="Max branches" value={String(d.currentSubscription.maxBranches)} />
              <Row label="Max devices" value={String(d.currentSubscription.maxDevices)} />
            </dl>
          ) : (
            <p className="text-sm text-ink-muted">No active subscription.</p>
          )}
        </SaasCard>

        <SaasCard title="Usage">
          <dl className="space-y-2 text-sm">
            <Row label="Users" value={String(d.usersCount)} />
            <Row label="Branches" value={String(d.branchesCount)} />
            <Row label="Devices" value={String(d.devicesCount)} />
            <Row label="Activation codes" value={String(d.activationCodesCount)} />
            <Row label="Last device sync" value={formatSaasDateTime(d.lastDeviceSyncAt)} />
          </dl>
        </SaasCard>
      </div>

      {perms.canManageBilling ? (
        <div className="flex flex-wrap gap-2">
          {d.client.status === 'ACTIVE' ? (
            <Button variant="danger" size="sm" onClick={() => suspendM.mutate()} disabled={suspendM.isPending}>
              Suspend client
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => reactivateM.mutate()} disabled={reactivateM.isPending}>
              Reactivate client
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}
