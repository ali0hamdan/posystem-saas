import { useEffect, useMemo, useState } from 'react';

import { useForm, type Resolver } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';

import { z } from 'zod';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from 'sonner';

import { Modal } from '@/components/ui/Modal';

import { getApiErrorMessage } from '@/api/client';

import { regenerateApprovalId, regenerateSalesmanId, registerNfcCard, removeNfcCard, setApprovalPin, setNfcEnabled, updateUser } from '@/api/users.api';

import type { RoleMeta } from '@/api/permissions.api';

import { usePermissions } from '@/hooks/use-permissions';

import { formatRoleLabel } from '@/lib/format-user';

import type { UserRole } from '@/types/auth';

import type { AdminUser } from '@/types/users-admin';

import { useAuthStore } from '@/stores/auth-store';

import { NfcScanInput } from '@/components/ui/NfcScanInput';



function buildSchema(canChangeRole: boolean, allowedRoles: UserRole[]) {

  return z

    .object({

      name: z.string().min(1, 'Name is required').max(120),

      username: z.string().min(2, 'At least 2 characters').max(64),

      email: z.string().max(254).optional(),

      role: z.string().optional(),

    })

    .superRefine((data, ctx) => {

      if (canChangeRole) {

        const r = data.role as UserRole | undefined;

        if (!r || !allowedRoles.includes(r)) {

          ctx.addIssue({ code: 'custom', path: ['role'], message: 'Select a role' });

        }

      }

      const e = data.email?.trim();

      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {

        ctx.addIssue({ code: 'custom', path: ['email'], message: 'Invalid email address' });

      }

    });

}



type FormValues = z.infer<ReturnType<typeof buildSchema>>;



type EditUserModalProps = {

  user: AdminUser | null;

  open: boolean;

  onClose: () => void;

  canChangeRole: boolean;

  roleOptions: RoleMeta[];

};



export function EditUserModal({ user, open, onClose, canChangeRole, roleOptions }: EditUserModalProps) {

  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const me = useAuthStore((s) => s.user);
  const canRegenerateSalesmanId = can('users:update');
  const canRegenerateApprovalId = me?.role === 'OWNER';
  const canManageNfc = me?.role === 'OWNER';
  const canSetOwnPin =
    me?.role === 'OWNER' ||
    (user != null && me?.id === user.id && (user.role === 'GENERAL_MANAGER' || user.role === 'CO_MANAGER'));
  const [nfcScanUid, setNfcScanUid] = useState('');
  const [newApprovalPin, setNewApprovalPin] = useState('');

  const allowedRoles = useMemo(() => roleOptions.map((r) => r.role), [roleOptions]);

  const schema = buildSchema(canChangeRole, allowedRoles);



  const form = useForm<FormValues>({

    resolver: zodResolver(schema) as Resolver<FormValues>,

    defaultValues: {

      name: '',

      username: '',

      email: '',

      role: 'CASHIER',

    },

  });



  const selectedRole = form.watch('role') as UserRole | undefined;

  const selectedMeta = roleOptions.find((r) => r.role === selectedRole);



  useEffect(() => {

    if (!open || !user) return;

    form.reset({

      name: user.name,

      username: user.username,

      email: user.email ?? '',

      role: user.role,

    });

  }, [open, user, form]);



  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateUser>[1] }) => updateUser(id, body),
    onSuccess: () => {
      toast.success('User updated');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not update user'));
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => regenerateSalesmanId(id),
    onSuccess: (updated) => {
      toast.success(`Salesman ID regenerated: ${updated.salesmanIdCode ?? 'updated'}`);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not regenerate Salesman ID'));
    },
  });

  const regenerateApprovalMutation = useMutation({
    mutationFn: (id: string) => regenerateApprovalId(id),
    onSuccess: (updated) => {
      toast.success(`Approval ID regenerated: ${updated.approvalIdCode ?? 'updated'}`);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not regenerate Approval ID'));
    },
  });

  const registerNfcMutation = useMutation({
    mutationFn: ({ id, uid }: { id: string; uid: string }) => registerNfcCard(id, uid),
    onSuccess: () => {
      toast.success('NFC card registered');
      setNfcScanUid('');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not register NFC card')),
  });

  const removeNfcMutation = useMutation({
    mutationFn: (id: string) => removeNfcCard(id),
    onSuccess: () => {
      toast.success('NFC card removed');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not remove NFC card')),
  });

  const nfcEnabledMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => setNfcEnabled(id, enabled),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not update NFC setting')),
  });

  const approvalPinMutation = useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) => setApprovalPin(id, pin),
    onSuccess: () => {
      toast.success('Approval PIN saved');
      setNewApprovalPin('');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not save approval PIN')),
  });



  const busy = mutation.isPending;



  function onSubmit(values: FormValues) {

    if (!user) return;

    const emailTrim = values.email?.trim();

    const body: Parameters<typeof updateUser>[1] = {

      name: values.name.trim(),

      username: values.username.trim(),

    };

    if (form.formState.dirtyFields.email) {

      body.email = emailTrim === '' ? null : emailTrim;

    }

    if (canChangeRole && form.formState.dirtyFields.role && values.role) {

      body.role = values.role as UserRole;

    }

    mutation.mutate({ id: user.id, body });

  }



  if (!user) return null;



  return (

    <Modal

      open={open}

      onClose={onClose}

      title="Edit user"

      description={`${user.username}`}

      size="lg"

      footer={

        <div className="flex justify-end gap-3">

          <button

            type="button"

            onClick={onClose}

            disabled={busy}

            className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-canvas disabled:opacity-50"

          >

            Cancel

          </button>

          <button

            type="submit"

            form="edit-user-form"

            disabled={busy}

            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"

          >

            {busy ? 'Saving…' : 'Save changes'}

          </button>

        </div>

      }

    >

      <form id="edit-user-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>

        <div>

          <label htmlFor="eu-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">

            Name

          </label>

          <input

            id="eu-name"

            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"

            {...form.register('name')}

          />

          {form.formState.errors.name ? (

            <p className="mt-1 text-xs text-danger-600">{form.formState.errors.name.message}</p>

          ) : null}

        </div>

        <div>

          <label htmlFor="eu-username" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">

            Username

          </label>

          <input

            id="eu-username"

            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"

            {...form.register('username')}

          />

          {form.formState.errors.username ? (

            <p className="mt-1 text-xs text-danger-600">{form.formState.errors.username.message}</p>

          ) : null}

        </div>

        <div>

          <label htmlFor="eu-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">

            Email <span className="font-normal text-ink-faint">(leave empty to clear)</span>

          </label>

          <input

            id="eu-email"

            type="email"

            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"

            {...form.register('email')}

          />

          {form.formState.errors.email ? (

            <p className="mt-1 text-xs text-danger-600">{form.formState.errors.email.message}</p>

          ) : null}

        </div>

        {canChangeRole ? (

          <div>

            <label htmlFor="eu-role" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">

              Role

            </label>

            <select

              id="eu-role"

              className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"

              {...form.register('role')}

            >

              {roleOptions.map((r) => (

                <option key={r.role} value={r.role}>

                  {formatRoleLabel(r.role)}

                </option>

              ))}

            </select>

            {selectedMeta?.description ? (

              <p className="mt-1.5 text-xs text-ink-muted">{selectedMeta.description}</p>

            ) : null}

            {form.formState.errors.role ? (

              <p className="mt-1 text-xs text-danger-600">{form.formState.errors.role.message}</p>

            ) : null}

          </div>

        ) : (

          <div>

            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">Role</p>

            <p className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink">

              {formatRoleLabel(user.role)} <span className="text-ink-faint">(only owners can change roles)</span>

            </p>

          </div>

        )}

        {user.role === 'SALESMAN' ? (
          <div className="rounded-lg border border-line bg-canvas px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Salesman ID</p>
            <p className="mt-1 font-mono text-sm text-ink">{user.salesmanIdCode ?? 'Pending generation'}</p>
            {canRegenerateSalesmanId ? (
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-primary-700 hover:underline"
                disabled={regenerateMutation.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      'Changing this Salesman ID affects future invoice assignment only. Old invoices remain linked to the same salesman user. Continue?',
                    )
                  ) {
                    return;
                  }
                  regenerateMutation.mutate(user.id);
                }}
              >
                Regenerate Salesman ID
              </button>
            ) : null}
          </div>
        ) : null}

        {user.role === 'GENERAL_MANAGER' || user.role === 'CO_MANAGER' ? (
          <div className="rounded-lg border border-line bg-canvas px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Approval ID</p>
            <p className="mt-1 font-mono text-sm text-ink">{user.approvalIdCode ?? 'Pending generation'}</p>
            {canRegenerateApprovalId ? (
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-primary-700 hover:underline"
                disabled={regenerateApprovalMutation.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      'Changing this approval ID will affect future refund approvals only. Old refunds remain linked to the approving user. Continue?',
                    )
                  ) {
                    return;
                  }
                  regenerateApprovalMutation.mutate(user.id);
                }}
              >
                Regenerate Approval ID
              </button>
            ) : null}

            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">NFC approval</p>
              <p className="mt-1 text-sm text-ink">
                {user.nfcCardRegistered
                  ? user.nfcCardMasked ?? 'NFC card registered'
                  : 'No NFC card registered'}
              </p>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={Boolean(user.nfcEnabled)}
                  disabled={!canManageNfc || !user.nfcCardRegistered || nfcEnabledMutation.isPending}
                  onChange={(e) => nfcEnabledMutation.mutate({ id: user.id, enabled: e.target.checked })}
                />
                NFC enabled for refund approval
              </label>
              {canManageNfc ? (
                <div className="mt-3 space-y-3">
                  <NfcScanInput
                    label="Register NFC card"
                    value={nfcScanUid}
                    onChange={setNfcScanUid}
                    disabled={registerNfcMutation.isPending}
                    onScanComplete={(uid) => registerNfcMutation.mutate({ id: user.id, uid })}
                  />
                  <button
                    type="button"
                    className="text-xs font-semibold text-danger-700 hover:underline"
                    disabled={!user.nfcCardRegistered || removeNfcMutation.isPending}
                    onClick={() => {
                      if (!window.confirm('Remove this manager NFC card?')) return;
                      removeNfcMutation.mutate(user.id);
                    }}
                  >
                    Remove NFC card
                  </button>
                </div>
              ) : null}
              {canSetOwnPin ? (
                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Set approval PIN (4–6 digits)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={newApprovalPin}
                      onChange={(e) => setNewApprovalPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="h-10 w-40 rounded-lg border border-line bg-canvas px-3 font-mono text-sm"
                      placeholder="••••"
                    />
                    <button
                      type="button"
                      className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink hover:bg-canvas"
                      disabled={newApprovalPin.length < 4 || approvalPinMutation.isPending}
                      onClick={() => approvalPinMutation.mutate({ id: user.id, pin: newApprovalPin })}
                    >
                      Save PIN
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

      </form>

    </Modal>

  );

}

