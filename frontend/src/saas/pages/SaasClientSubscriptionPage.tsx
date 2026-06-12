import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { FieldLabel, SelectInput, TextInput } from '@/components/ui/input';
import { SaasCard } from '@/saas/components/SaasCard';
import { SaasStatusBadge } from '@/saas/components/SaasStatusBadge';
import {
  changeClientPlan,
  fetchClientPaymentRecords,
  fetchClientSubscription,
  renewClientSubscription,
} from '@/saas/api/saas-clients.api';
import { fetchSaasPlans } from '@/saas/api/saas-plans.api';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { useSaasPermissions } from '@/saas/hooks/use-saas-permissions';
import { daysUntil } from '@/saas/lib/dashboard-stats';
import { formatSaasDate } from '@/saas/lib/format-date';
import type { LicensePlanCode } from '@/saas/types';


export function SaasClientSubscriptionPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const perms = useSaasPermissions();
  const [renewOpen, setRenewOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [extendDays, setExtendDays] = useState('365');
  const [planCode, setPlanCode] = useState<LicensePlanCode>('PRO');

  const subQ = useQuery({
    queryKey: ['saas', 'clients', id, 'subscription'],
    queryFn: () => fetchClientSubscription(id),
    enabled: Boolean(id),
  });

  const paymentsQ = useQuery({
    queryKey: ['saas', 'clients', id, 'payment-records'],
    queryFn: () => fetchClientPaymentRecords(id),
    enabled: Boolean(id),
  });

  const plansQ = useQuery({ queryKey: ['saas', 'plans'], queryFn: fetchSaasPlans });

  const renewM = useMutation({
    mutationFn: () => renewClientSubscription(id, { extendDays: Number(extendDays) || 365 }),
    onSuccess: () => {
      toast.success('Subscription renewed');
      setRenewOpen(false);
      void qc.invalidateQueries({ queryKey: ['saas', 'clients', id] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e)),
  });

  const planM = useMutation({
    mutationFn: () => changeClientPlan(id, { planCode }),
    onSuccess: () => {
      toast.success('Plan changed');
      setPlanOpen(false);
      void qc.invalidateQueries({ queryKey: ['saas', 'clients', id] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e)),
  });

  const sub = subQ.data?.subscription;
  const usage = subQ.data?.usage;

  if (subQ.isLoading) return <p className="text-sm text-ink-muted">Loading subscription…</p>;
  if (subQ.isError) return <p className="text-sm text-danger-600">{getSaasApiErrorMessage(subQ.error)}</p>;

  return (
    <div className="space-y-6">
      <SaasCard title="Current subscription">
        {sub ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Item label="Plan" value={`${sub.plan.name} (${sub.plan.code})`} />
            <Item label="Status" value={<SaasStatusBadge status={sub.status} />} />
            <Item label="Starts" value={formatSaasDate(sub.startsAt)} />
            <Item label="Expires" value={formatSaasDate(sub.expiresAt)} />
            <Item label="Days remaining" value={String(daysUntil(sub.expiresAt))} />
            <Item label="Grace days" value={String(sub.graceDays)} />
            <Item label="Max users" value={sub.maxUsers ?? 'Unlimited'} />
            <Item label="Max branches" value={sub.maxBranches ?? 'Unlimited'} />
            <Item label="Max devices" value={sub.maxDevices ?? 'Unlimited'} />
          </dl>
        ) : (
          <p className="text-ink-muted">No subscription on file.</p>
        )}
      </SaasCard>

      {usage ? (
        <SaasCard title="Usage vs limits">
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <Item label="Users" value={`${usage.users} / ${sub ? sub.maxUsers ?? 'Unlimited' : '—'}`} />
            <Item label="Branches" value={`${usage.branches} / ${sub ? sub.maxBranches ?? 'Unlimited' : '—'}`} />
            <Item label="Active devices" value={`${usage.devicesActive} / ${sub ? sub.maxDevices ?? 'Unlimited' : '—'}`} />
          </dl>
        </SaasCard>
      ) : null}

      {perms.canManageBilling ? (
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => setRenewOpen(true)}>
            Renew subscription
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPlanOpen(true)}>
            Change plan
          </Button>
        </div>
      ) : (
        <p className="text-xs text-ink-faint">Billing actions require SUPER_ADMIN or BILLING role.</p>
      )}

      {/* Payment history */}
      {paymentsQ.data && paymentsQ.data.length > 0 && (
        <SaasCard title="Payment history">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted border-b border-line">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Cycle</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paymentsQ.data.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 text-ink-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="py-2">{r.plan.name}</td>
                    <td className="py-2 font-medium">${r.amount} {r.currency}</td>
                    <td className="py-2 text-ink-muted">{r.billingCycle}</td>
                    <td className="py-2">
                      <SaasStatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SaasCard>
      )}

      <Modal
        open={renewOpen}
        title="Renew subscription"
        onClose={() => setRenewOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenewOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => renewM.mutate()} disabled={renewM.isPending}>
              Renew
            </Button>
          </>
        }
      >
        <FieldLabel htmlFor="ext">Extend by (days)</FieldLabel>
        <TextInput id="ext" type="number" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} />
      </Modal>

      <Modal
        open={planOpen}
        title="Change plan"
        onClose={() => setPlanOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlanOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => planM.mutate()} disabled={planM.isPending}>
              Change plan
            </Button>
          </>
        }
      >
        <FieldLabel htmlFor="pl">Plan</FieldLabel>
        <SelectInput id="pl" value={planCode} onChange={(e) => setPlanCode(e.target.value as LicensePlanCode)}>
          {(plansQ.data ?? []).map((p) => (
            <option key={p.id} value={p.code}>
              {p.name}
            </option>
          ))}
        </SelectInput>
      </Modal>
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}
