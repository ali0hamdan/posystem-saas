import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { PasswordInput } from '@/components/ui/password-input';
import { getApiErrorMessage } from '@/api/client';
import { updateUserPassword } from '@/api/users.api';

const schema = z
  .object({
    newPassword: z.string().min(8, 'At least 8 characters').max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
    }
  });

type FormValues = z.infer<typeof schema>;

type ResetPasswordModalProps = {
  userId: string | null;
  username: string | null;
  open: boolean;
  onClose: () => void;
};

export function ResetPasswordModal({ userId, username, open, onClose }: ResetPasswordModalProps) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ newPassword: '', confirmPassword: '' });
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      updateUserPassword(id, { newPassword }),
    onSuccess: () => {
      toast.success('Password updated');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not reset password'));
    },
  });

  const busy = mutation.isPending;

  function onSubmit(values: FormValues) {
    if (!userId) return;
    mutation.mutate({ id: userId, newPassword: values.newPassword });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reset password"
      description={username ? `Set a new password for ${username}.` : undefined}
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
            form="reset-password-form"
            disabled={busy || !userId}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </div>
      }
    >
      <form id="reset-password-form" className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="rp-new" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            New password
          </label>
          <PasswordInput
            id="rp-new"
            autoComplete="new-password"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
            {...form.register('newPassword')}
          />
          {form.formState.errors.newPassword ? (
            <p className="mt-1 text-xs text-danger-600">{form.formState.errors.newPassword.message}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="rp-confirm" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Confirm password
          </label>
          <PasswordInput
            id="rp-confirm"
            autoComplete="new-password"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
            {...form.register('confirmPassword')}
          />
          {form.formState.errors.confirmPassword ? (
            <p className="mt-1 text-xs text-danger-600">{form.formState.errors.confirmPassword.message}</p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
