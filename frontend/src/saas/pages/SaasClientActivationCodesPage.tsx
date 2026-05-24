import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Copy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { FieldLabel, SelectInput, TextInput } from '@/components/ui/input';
import { DataTable, DataTableShell, Td, Th } from '@/components/ui/data-table';
import {
  createClientActivationCode,
  fetchClientActivationCodes,
  revokeActivationCode,
} from '@/saas/api/saas-clients.api';
import { fetchSaasPlans } from '@/saas/api/saas-plans.api';
import { SaasStatusBadge } from '@/saas/components/SaasStatusBadge';
import { SaasQueryError, SaasTableSkeleton } from '@/saas/components/SaasQueryState';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { useSaasPermissions } from '@/saas/hooks/use-saas-permissions';
import { formatSaasDate } from '@/saas/lib/format-date';
import type { LicensePlanCode } from '@/saas/types';


export function SaasClientActivationCodesPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const perms = useSaasPermissions();
  const [open, setOpen] = useState(false);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [plan, setPlan] = useState<LicensePlanCode>('STARTER');
  const [validDays, setValidDays] = useState('30');
  const [maxUses, setMaxUses] = useState('1');
  const [label, setLabel] = useState('');

  const codesQ = useQuery({
    queryKey: ['saas', 'clients', id, 'activation-codes'],
    queryFn: () => fetchClientActivationCodes(id),
    enabled: Boolean(id),
  });

  const plansQ = useQuery({ queryKey: ['saas', 'plans'], queryFn: fetchSaasPlans });

  const createM = useMutation({
    mutationFn: () =>
      createClientActivationCode(id, {
        plan,
        termDays: 365,
        maxBranches: 3,
        maxDevices: 5,
        graceDays: 7,
        maxUses: Number(maxUses) || 1,
        validDays: Number(validDays) || 30,
        label: label.trim() || undefined,
      }),
    onSuccess: (data) => {
      setRevealedCode(data.activationCode);
      toast.success('Activation code generated');
      void qc.invalidateQueries({ queryKey: ['saas', 'clients', id, 'activation-codes'] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e)),
  });

  const revokeM = useMutation({
    mutationFn: revokeActivationCode,
    onSuccess: () => {
      toast.success('Code revoked');
      void qc.invalidateQueries({ queryKey: ['saas', 'clients', id, 'activation-codes'] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e)),
  });

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="space-y-4">
      {perms.canCreateActivationCode ? (
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Generate code
        </Button>
      ) : null}

      {codesQ.isLoading ? <SaasTableSkeleton /> : null}
      {codesQ.isError ? (
        <SaasQueryError message={getSaasApiErrorMessage(codesQ.error)} onRetry={() => codesQ.refetch()} />
      ) : null}

      {codesQ.data ? (
        <DataTableShell>
          <DataTable>
            <thead>
              <tr>
                <Th>Status</Th>
                <Th>Plan</Th>
                <Th>Valid until</Th>
                <Th>Uses</Th>
                <Th>Label</Th>
                <Th>—</Th>
              </tr>
            </thead>
            <tbody>
              {codesQ.data.data.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <SaasStatusBadge status={c.status} />
                  </Td>
                  <Td>{c.plan.name}</Td>
                  <Td>{formatSaasDate(c.validUntil)}</Td>
                  <Td>
                    {c.usedCount}/{c.maxUses}
                  </Td>
                  <Td>{c.label ?? '—'}</Td>
                  <Td>
                    {c.status === 'UNUSED' && perms.canRevokeActivationCode ? (
                      <Button variant="ghost" size="sm" onClick={() => revokeM.mutate(c.id)}>
                        Revoke
                      </Button>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </DataTableShell>
      ) : null}

      <Modal
        open={open}
        title="Generate activation code"
        onClose={() => {
          setOpen(false);
          setRevealedCode(null);
        }}
        size="lg"
        footer={
          revealedCode ? (
            <Button variant="primary" onClick={() => setOpen(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => createM.mutate()} disabled={createM.isPending}>
                Generate
              </Button>
            </>
          )
        }
      >
        {revealedCode ? (
          <div className="space-y-4">
            <p className="rounded-lg border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-800">
              Save this code now or copy it to the client. It may not be shown again.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas p-4 font-mono text-lg text-ink">
              <span className="flex-1 break-all">{revealedCode}</span>
              <Button variant="secondary" size="sm" onClick={() => copyCode(revealedCode)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="ac-plan">Plan</FieldLabel>
              <SelectInput id="ac-plan" value={plan} onChange={(e) => setPlan(e.target.value as LicensePlanCode)}>
                {(plansQ.data ?? []).map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div>
              <FieldLabel htmlFor="ac-days">Valid (days)</FieldLabel>
              <TextInput id="ac-days" type="number" value={validDays} onChange={(e) => setValidDays(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="ac-uses">Max uses</FieldLabel>
              <TextInput id="ac-uses" type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="ac-label">Notes</FieldLabel>
              <TextInput id="ac-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
