import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { getApiErrorMessage } from '@/api/client';
import { updateUser } from '@/api/users.api';
import { formatRoleLabel } from '@/lib/format-user';
import type { UserRole } from '@/types/auth';
import type { AdminUser } from '@/types/users-admin';

const ALL_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'CASHIER'];

function buildSchema(canChangeRole: boolean) {
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
        if (!r || !ALL_ROLES.includes(r)) {
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
};

export function EditUserModal({ user, open, onClose, canChangeRole }: EditUserModalProps) {
  const queryClient = useQueryClient();
  const schema = buildSchema(canChangeRole);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: '',
      username: '',
      email: '',
      role: 'CASHIER',
    },
  });

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
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {formatRoleLabel(r)}
                </option>
              ))}
            </select>
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
      </form>
    </Modal>
  );
}
