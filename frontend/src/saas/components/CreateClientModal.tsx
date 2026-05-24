import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { FieldLabel, SelectInput, TextInput } from '@/components/ui/input';
import { createSaasClient } from '@/saas/api/saas-clients.api';
import { fetchSaasPlans } from '@/saas/api/saas-plans.api';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import {
  resolveSubscriptionPlanOptions,
  termDaysForPlanCode,
  type SubscriptionPlanOption,
} from '@/saas/lib/subscription-plans';
import type { LicensePlanCode } from '@/saas/types';
import { saasFormFieldClass } from '@/saas/lib/form-styles';


type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
};

export function CreateClientModal({ open, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const plansQ = useQuery({ queryKey: ['saas', 'plans'], queryFn: fetchSaasPlans, enabled: open });

  const planOptions = useMemo(
    () => resolveSubscriptionPlanOptions(plansQ.data),
    [plansQ.data],
  );

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [createOwner, setCreateOwner] = useState(true);
  const [ownerUsername, setOwnerUsername] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [planCode, setPlanCode] = useState<LicensePlanCode>('STARTER');
  const [withSubscription, setWithSubscription] = useState(true);

  const selectedPlan: SubscriptionPlanOption =
    planOptions.find((p) => p.code === planCode) ?? planOptions[0]!;

  const reset = () => {
    setBusinessName('');
    setOwnerName('');
    setEmail('');
    setPhone('');
    setCreateOwner(true);
    setOwnerUsername('');
    setOwnerPassword('');
    setPlanCode('STARTER');
    setWithSubscription(true);
  };

  const mutation = useMutation({
    mutationFn: createSaasClient,
    onSuccess: (data) => {
      toast.success('Client created');
      void qc.invalidateQueries({ queryKey: ['saas', 'clients'] });
      void qc.invalidateQueries({ queryKey: ['saas', 'subscriptions'] });
      onCreated?.(data.client.id);
      reset();
      onClose();
    },
    onError: (err) => toast.error(getSaasApiErrorMessage(err, 'Could not create client')),
  });

  const submit = () => {
    if (!businessName.trim() || !ownerName.trim() || !email.trim()) {
      toast.error('Business name, owner name, and email are required');
      return;
    }
    if (createOwner && (!ownerUsername.trim() || ownerPassword.length < 8)) {
      toast.error('Owner username and password (min 8 chars) are required');
      return;
    }
    const termDays = termDaysForPlanCode(planCode, planOptions);
    mutation.mutate({
      businessName: businessName.trim(),
      ownerName: ownerName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      owner: createOwner
        ? {
            username: ownerUsername.trim().toLowerCase(),
            password: ownerPassword,
            name: ownerName.trim(),
            email: email.trim(),
          }
        : undefined,
      subscription: withSubscription
        ? { planCode: selectedPlan.code, termDays }
        : undefined,
    });
  };

  return (
    <Modal
      open={open}
      title="Create client"
      description="Provision a new POS tenant with optional owner and subscription."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create client'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="bc-name">Business name</FieldLabel>
          <TextInput
            id="bc-name"
            className={saasFormFieldClass}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="bc-owner">Owner name</FieldLabel>
          <TextInput
            id="bc-owner"
            className={saasFormFieldClass}
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="bc-email">Email</FieldLabel>
          <TextInput
            id="bc-email"
            type="email"
            className={saasFormFieldClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="bc-phone">Phone</FieldLabel>
          <TextInput
            id="bc-phone"
            className={saasFormFieldClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            id="bc-sub"
            type="checkbox"
            checked={withSubscription}
            onChange={(e) => setWithSubscription(e.target.checked)}
            className="rounded border-line text-primary-500"
          />
          <label htmlFor="bc-sub" className="text-sm text-ink">
            Create subscription
          </label>
        </div>
        {withSubscription ? (
          <div>
            <FieldLabel htmlFor="bc-plan">Plan</FieldLabel>
            <SelectInput
              id="bc-plan"
              className={saasFormFieldClass}
              value={planCode}
              onChange={(e) => setPlanCode(e.target.value as LicensePlanCode)}
              disabled={plansQ.isLoading}
            >
              {planOptions.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </SelectInput>
            <p className="mt-1 text-xs text-ink-muted">
              {selectedPlan.label} · {selectedPlan.termDays} days
            </p>
          </div>
        ) : null}
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            id="bc-own"
            type="checkbox"
            checked={createOwner}
            onChange={(e) => setCreateOwner(e.target.checked)}
            className="rounded border-line text-primary-500"
          />
          <label htmlFor="bc-own" className="text-sm text-ink">
            Create owner user
          </label>
        </div>
        {createOwner ? (
          <>
            <div>
              <FieldLabel htmlFor="bc-user">Owner username</FieldLabel>
              <TextInput
                id="bc-user"
                className={saasFormFieldClass}
                value={ownerUsername}
                onChange={(e) => setOwnerUsername(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="bc-pass">Owner password</FieldLabel>
              <TextInput
                id="bc-pass"
                type="password"
                className={saasFormFieldClass}
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
              />
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
