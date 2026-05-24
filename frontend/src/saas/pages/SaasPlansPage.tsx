import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { FieldLabel, SelectInput, TextInput } from '@/components/ui/input';
import { DataTable, DataTableShell, Td, Th } from '@/components/ui/data-table';
import { createSaasPlan, fetchSaasPlans, patchSaasPlan } from '@/saas/api/saas-plans.api';
import { SaasQueryError, SaasTableSkeleton } from '@/saas/components/SaasQueryState';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { useSaasPermissions } from '@/saas/hooks/use-saas-permissions';
import type { LicensePlanCode, SaasPlan } from '@/saas/types';


export function SaasPlansPage() {
  const qc = useQueryClient();
  const perms = useSaasPermissions();

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState<LicensePlanCode>('STARTER');
  const [name, setName] = useState('');
  const [maxUsers, setMaxUsers] = useState('5');
  const [maxBranches, setMaxBranches] = useState('1');
  const [maxDevices, setMaxDevices] = useState('3');

  // Edit modal state
  const [editPlan, setEditPlan] = useState<SaasPlan | null>(null);
  const [editName, setEditName] = useState('');
  const [editMonthly, setEditMonthly] = useState('');
  const [editYearly, setEditYearly] = useState('');
  const [editOneTime, setEditOneTime] = useState('');
  const [editMaxUsers, setEditMaxUsers] = useState('');
  const [editMaxBranches, setEditMaxBranches] = useState('');
  const [editMaxDevices, setEditMaxDevices] = useState('');
  const [editActive, setEditActive] = useState(true);

  const plansQ = useQuery({ queryKey: ['saas', 'plans'], queryFn: fetchSaasPlans });

  const createM = useMutation({
    mutationFn: createSaasPlan,
    onSuccess: () => {
      toast.success('Plan created');
      setCreateOpen(false);
      void qc.invalidateQueries({ queryKey: ['saas', 'plans'] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e)),
  });

  const editM = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof patchSaasPlan>[1] }) =>
      patchSaasPlan(id, body),
    onSuccess: () => {
      toast.success('Plan updated');
      setEditPlan(null);
      void qc.invalidateQueries({ queryKey: ['saas', 'plans'] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e)),
  });

  function openEdit(p: SaasPlan) {
    setEditPlan(p);
    setEditName(p.name);
    setEditMonthly(p.monthlyPrice ?? '');
    setEditYearly(p.yearlyPrice ?? '');
    setEditOneTime(p.oneTimePrice ?? '');
    setEditMaxUsers(String(p.maxUsers));
    setEditMaxBranches(String(p.maxBranches));
    setEditMaxDevices(String(p.maxDevices));
    setEditActive(p.isActive);
  }

  function submitEdit() {
    if (!editPlan) return;
    editM.mutate({
      id: editPlan.id,
      body: {
        name: editName.trim() || undefined,
        monthlyPrice: editMonthly ? Number(editMonthly) : null,
        yearlyPrice: editYearly ? Number(editYearly) : null,
        oneTimePrice: editOneTime ? Number(editOneTime) : null,
        maxUsers: Number(editMaxUsers) || editPlan.maxUsers,
        maxBranches: Number(editMaxBranches) || editPlan.maxBranches,
        maxDevices: Number(editMaxDevices) || editPlan.maxDevices,
        isActive: editActive,
      },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Subscription tiers and resource limits."
        actions={
          perms.canManagePlans ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create plan
            </Button>
          ) : null
        }
      />

      {plansQ.isLoading ? <SaasTableSkeleton /> : null}
      {plansQ.isError ? (
        <SaasQueryError message={getSaasApiErrorMessage(plansQ.error)} onRetry={() => plansQ.refetch()} />
      ) : null}

      {plansQ.data ? (
        <DataTableShell>
          <DataTable>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Monthly</Th>
                <Th>Yearly</Th>
                <Th>One-time</Th>
                <Th>Max users</Th>
                <Th>Max branches</Th>
                <Th>Max devices</Th>
                <Th>Active</Th>
                {perms.canManagePlans ? <Th>—</Th> : null}
              </tr>
            </thead>
            <tbody>
              {plansQ.data.map((p) => (
                <tr key={p.id}>
                  <Td className="font-mono text-xs">{p.code}</Td>
                  <Td>{p.name}</Td>
                  <Td>{p.monthlyPrice ? `$${p.monthlyPrice}` : '—'}</Td>
                  <Td>{p.yearlyPrice ? `$${p.yearlyPrice}` : '—'}</Td>
                  <Td>{p.oneTimePrice ? `$${p.oneTimePrice}` : '—'}</Td>
                  <Td>{p.maxUsers}</Td>
                  <Td>{p.maxBranches}</Td>
                  <Td>{p.maxDevices}</Td>
                  <Td>{p.isActive !== false ? '✓' : '✗'}</Td>
                  {perms.canManagePlans ? (
                    <Td>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </DataTable>
        </DataTableShell>
      ) : null}

      {/* Create modal */}
      <Modal
        open={createOpen}
        title="Create plan"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                createM.mutate({
                  code,
                  name: name.trim(),
                  maxUsers: Number(maxUsers) || 5,
                  maxBranches: Number(maxBranches) || 1,
                  maxDevices: Number(maxDevices) || 3,
                })
              }
              disabled={createM.isPending || !name.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="pl-code">Code</FieldLabel>
            <SelectInput id="pl-code" value={code} onChange={(e) => setCode(e.target.value as LicensePlanCode)}>
              <option value="STARTER">STARTER</option>
              <option value="BUSINESS">BUSINESS</option>
              <option value="PRO">PRO</option>
              <option value="LIFETIME_DESKTOP">LIFETIME_DESKTOP</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="pl-name">Name</FieldLabel>
            <TextInput id="pl-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="pl-u">Max users</FieldLabel>
            <TextInput id="pl-u" type="number" value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="pl-b">Max branches</FieldLabel>
            <TextInput id="pl-b" type="number" value={maxBranches} onChange={(e) => setMaxBranches(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="pl-d">Max devices</FieldLabel>
            <TextInput id="pl-d" type="number" value={maxDevices} onChange={(e) => setMaxDevices(e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={Boolean(editPlan)}
        title={`Edit plan — ${editPlan?.code ?? ''}`}
        onClose={() => setEditPlan(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditPlan(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitEdit} disabled={editM.isPending || !editName.trim()}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="ep-name">Name</FieldLabel>
            <TextInput id="ep-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="ep-monthly">Monthly price ($)</FieldLabel>
            <TextInput id="ep-monthly" type="number" step="0.01" placeholder="e.g. 29.99" value={editMonthly} onChange={(e) => setEditMonthly(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="ep-yearly">Yearly price ($)</FieldLabel>
            <TextInput id="ep-yearly" type="number" step="0.01" placeholder="e.g. 299.00" value={editYearly} onChange={(e) => setEditYearly(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="ep-onetime">One-time price ($)</FieldLabel>
            <TextInput id="ep-onetime" type="number" step="0.01" placeholder="e.g. 499.00" value={editOneTime} onChange={(e) => setEditOneTime(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="ep-u">Max users</FieldLabel>
            <TextInput id="ep-u" type="number" value={editMaxUsers} onChange={(e) => setEditMaxUsers(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="ep-b">Max branches</FieldLabel>
            <TextInput id="ep-b" type="number" value={editMaxBranches} onChange={(e) => setEditMaxBranches(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="ep-d">Max devices</FieldLabel>
            <TextInput id="ep-d" type="number" value={editMaxDevices} onChange={(e) => setEditMaxDevices(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="ep-active"
              type="checkbox"
              checked={editActive}
              onChange={(e) => setEditActive(e.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            <FieldLabel htmlFor="ep-active">Active</FieldLabel>
          </div>
        </div>
      </Modal>
    </div>
  );
}
