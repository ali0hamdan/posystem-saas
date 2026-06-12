import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SaasCard } from '@/saas/components/SaasCard';
import { SaasStatusBadge } from '@/saas/components/SaasStatusBadge';
import { fetchSaasClient, patchSaasClient, reactivateClient, suspendClient } from '@/saas/api/saas-clients.api';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { useSaasPermissions } from '@/saas/hooks/use-saas-permissions';
import { formatSaasDate, formatSaasDateTime } from '@/saas/lib/format-date';
import type { BusinessType, SaasClientDetail } from '@/saas/types';

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  RETAIL: 'Retail',
  FOOD_BEVERAGE: 'Food & Beverage',
  WHOLESALE: 'Wholesale / B2B',
  HYBRID: 'Hybrid (All modules)',
};


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

  const businessTypeM = useMutation({
    mutationFn: (businessType: BusinessType) => patchSaasClient(id, { businessType }),
    onSuccess: () => {
      toast.success('Business type updated');
      void qc.invalidateQueries({ queryKey: ['saas', 'clients', id] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e)),
  });

  const d = detailQ.data;

  const [bizType, setBizType] = useState<BusinessType>('RETAIL');
  useEffect(() => {
    if (d?.client.businessType) setBizType(d.client.businessType);
  }, [d?.client.businessType]);

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
            <Row label="Business type" value={BUSINESS_TYPE_LABELS[d.client.businessType]} />
          </dl>
        </SaasCard>

        <SaasCard title="Business type">
          <p className="mb-3 text-sm text-ink-muted">
            Controls which POS surfaces this client sees. F&B features still require the matching plan flags.
          </p>
          {perms.isSuperAdmin ? (
            <div className="space-y-3">
              <select
                value={bizType}
                onChange={(e) => setBizType(e.target.value as BusinessType)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none"
              >
                {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((t) => (
                  <option key={t} value={t}>
                    {BUSINESS_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={() => businessTypeM.mutate(bizType)}
                disabled={businessTypeM.isPending || bizType === d.client.businessType}
              >
                Save business type
              </Button>
            </div>
          ) : (
            <p className="text-sm font-medium text-ink">{BUSINESS_TYPE_LABELS[d.client.businessType]}</p>
          )}
        </SaasCard>

        <SaasCard title="Subscription">
          {d.currentSubscription ? (
            <dl className="space-y-2 text-sm">
              <Row label="Plan" value={d.plan?.name ?? '—'} />
              <Row
                label="Billing"
                value={
                  d.currentSubscription.isLifetime || d.currentSubscription.billingCycle === 'LIFETIME'
                    ? 'Lifetime desktop (one-time)'
                    : d.currentSubscription.billingCycle ?? 'Subscription'
                }
              />
              <Row label="Status" value={<SaasStatusBadge status={d.currentSubscription.status} />} />
              <Row
                label="Expires"
                value={
                  d.currentSubscription.expiresAt
                    ? formatSaasDate(d.currentSubscription.expiresAt)
                    : 'Never (lifetime)'
                }
              />
              <Row
                label="Desktop download"
                value={d.plan?.allowsDesktopDownload ? 'Enabled' : 'Not included'}
              />
              <Row label="Max users" value={d.currentSubscription.maxUsers ?? 'Unlimited'} />
              <Row label="Max branches" value={d.currentSubscription.maxBranches ?? 'Unlimited'} />
              <Row label="Max devices" value={d.currentSubscription.maxDevices ?? 'Unlimited'} />
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
