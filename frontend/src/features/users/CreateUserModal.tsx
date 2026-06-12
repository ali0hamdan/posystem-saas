import { useEffect, useMemo } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { PasswordInput } from '@/components/ui/password-input';
import { getApiErrorMessage } from '@/api/client';
import { createUser } from '@/api/users.api';
import type { RoleMeta } from '@/api/permissions.api';
import { formatRoleLabel } from '@/lib/format-user';
import type { UserRole } from '@/types/auth';

function buildSchema(allowedRoles: UserRole[]) {
  return z
    .object({
      name: z.string().min(1, 'Name is required').max(120),
      username: z.string().min(2, 'At least 2 characters').max(64),
      password: z.string().min(8, 'At least 8 characters').max(128),
      role: z.string(),
      email: z.string().max(254).optional(),
    })
    .superRefine((data, ctx) => {
      if (!allowedRoles.includes(data.role as UserRole)) {
        ctx.addIssue({ code: 'custom', path: ['role'], message: 'Invalid role' });
      }
      const e = data.email?.trim();
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'Invalid email address' });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

type CreateUserModalProps = {
  open: boolean;
  onClose: () => void;
  roleOptions: RoleMeta[];
};

function PermissionPreview({ permissions }: { permissions: string[] }) {
  const preview = permissions.slice(0, 10);
  const rest = permissions.length - preview.length;
  return (
    <div className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-xs text-ink-muted">
      <p className="mb-1.5 font-semibold uppercase tracking-wide text-ink-faint">Access preview</p>
      <ul className="flex flex-wrap gap-1">
        {preview.map((p) => (
          <li key={p} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink">
            {p}
          </li>
        ))}
        {rest > 0 ? <li className="px-1 py-0.5 text-ink-faint">+{rest} more</li> : null}
      </ul>
    </div>
  );
}

export function CreateUserModal({ open, onClose, roleOptions }: CreateUserModalProps) {
  const queryClient = useQueryClient();
  const allowedRoles = useMemo(() => roleOptions.map((r) => r.role), [roleOptions]);
  const schema = buildSchema(allowedRoles);
  const defaultRole = allowedRoles.includes('CASHIER') ? 'CASHIER' : allowedRoles[0];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: '',
      username: '',
      password: '',
      role: defaultRole,
      email: '',
    },
  });

  const selectedRole = form.watch('role') as UserRole | undefined;
  const selectedMeta = roleOptions.find((r) => r.role === selectedRole);

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: '',
      username: '',
      password: '',
      role: defaultRole,
      email: '',
    });
  }, [open, defaultRole, form]);

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: (created) => {
      if (created.role === 'SALESMAN' && created.salesmanIdCode) {
        toast.success(`User created. Salesman ID: ${created.salesmanIdCode}`);
      } else if (
        (created.role === 'GENERAL_MANAGER' || created.role === 'CO_MANAGER') &&
        created.approvalIdCode
      ) {
        toast.success(`User created. Approval ID: ${created.approvalIdCode}`);
      } else {
        toast.success('User created');
      }
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not create user'));
    },
  });

  const busy = mutation.isPending;

  function onSubmit(values: FormValues) {
    const emailTrim = values.email?.trim();
    mutation.mutate({
      name: values.name.trim(),
      username: values.username.trim(),
      password: values.password,
      role: values.role as UserRole,
      ...(emailTrim ? { email: emailTrim } : {}),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create user"
      description="Add a staff account. Password is stored securely and never returned in API responses."
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
            form="create-user-form"
            disabled={busy}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </div>
      }
    >
      <form id="create-user-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="cu-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Name
          </label>
          <input
            id="cu-name"
            autoComplete="name"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
            {...form.register('name')}
          />
          {form.formState.errors.name ? (
            <p className="mt-1 text-xs text-danger-600">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="cu-username" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Username
          </label>
          <input
            id="cu-username"
            autoComplete="username"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
            {...form.register('username')}
          />
          {form.formState.errors.username ? (
            <p className="mt-1 text-xs text-danger-600">{form.formState.errors.username.message}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="cu-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Email <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <input
            id="cu-email"
            type="email"
            autoComplete="email"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <p className="mt-1 text-xs text-danger-600">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="cu-role" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Role
          </label>
          <select
            id="cu-role"
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
        {selectedMeta?.permissions?.length ? (
          <PermissionPreview permissions={selectedMeta.permissions} />
        ) : null}
        <div>
          <label htmlFor="cu-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Initial password
          </label>
          <PasswordInput
            id="cu-password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
            {...form.register('password')}
          />
          {form.formState.errors.password ? (
            <p className="mt-1 text-xs text-danger-600">{form.formState.errors.password.message}</p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
