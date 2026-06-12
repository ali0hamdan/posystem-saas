import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/api/client';
import { updateUserCommissionSettings } from '@/api/commissions.api';
import type { AdminUser } from '@/types/users-admin';
import type { SalesCommissionType } from '@/types/commissions';

const schema = z
  .object({
    commissionEnabled: z.boolean(),
    commissionType: z.enum(['NONE', 'PERCENTAGE', 'FIXED_PER_SALE']),
    commissionRate: z.string(),
    fixedCommissionAmount: z.string(),
    commissionNotes: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.commissionEnabled && data.commissionType === 'NONE') {
      ctx.addIssue({ code: 'custom', path: ['commissionType'], message: 'Select a commission type' });
    }
    if (data.commissionType === 'PERCENTAGE') {
      const rate = Number(data.commissionRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        ctx.addIssue({ code: 'custom', path: ['commissionRate'], message: 'Rate must be 0–100' });
      }
    }
    if (data.commissionType === 'FIXED_PER_SALE') {
      const fixed = Number(data.fixedCommissionAmount);
      if (!Number.isFinite(fixed) || fixed < 0) {
        ctx.addIssue({ code: 'custom', path: ['fixedCommissionAmount'], message: 'Amount must be >= 0' });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

type CommissionSettingsModalProps = {
  user: AdminUser | null;
  open: boolean;
  onClose: () => void;
};

export function CommissionSettingsModal({ user, open, onClose }: CommissionSettingsModalProps) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      commissionEnabled: false,
      commissionType: 'NONE',
      commissionRate: '5',
      fixedCommissionAmount: '5',
      commissionNotes: '',
    },
  });

  useEffect(() => {
    if (!user || !open) return;
    form.reset({
      commissionEnabled: user.commissionEnabled ?? false,
      commissionType: (user.commissionType as SalesCommissionType | null) ?? 'NONE',
      commissionRate: user.commissionRate != null ? String(user.commissionRate) : '5',
      fixedCommissionAmount: user.fixedCommissionAmount != null ? String(user.fixedCommissionAmount) : '5',
      commissionNotes: user.commissionNotes ?? '',
    });
  }, [user, open, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!user) throw new Error('No user');
      return updateUserCommissionSettings(user.id, {
        commissionEnabled: values.commissionEnabled,
        commissionType: values.commissionType,
        commissionRate: values.commissionType === 'PERCENTAGE' ? Number(values.commissionRate) : undefined,
        fixedCommissionAmount:
          values.commissionType === 'FIXED_PER_SALE' ? Number(values.fixedCommissionAmount) : undefined,
        commissionNotes: values.commissionNotes.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success('Commission settings saved');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not save commission settings')),
  });

  const enabled = form.watch('commissionEnabled');
  const commissionType = form.watch('commissionType');

  if (!user) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Commission settings — ${user.name}`}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('commissionEnabled')} />
          Enable commission for this salesman
        </label>

        {enabled ? (
          <>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Commission type
              </label>
              <select className="h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm" {...form.register('commissionType')}>
                <option value="NONE">None</option>
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED_PER_SALE">Fixed per sale</option>
              </select>
            </div>

            {commissionType === 'PERCENTAGE' ? (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Commission rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  className="h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm"
                  {...form.register('commissionRate')}
                />
                {form.formState.errors.commissionRate ? (
                  <p className="mt-1 text-xs text-danger-700">{form.formState.errors.commissionRate.message}</p>
                ) : null}
              </div>
            ) : null}

            {commissionType === 'FIXED_PER_SALE' ? (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Fixed amount per sale
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm"
                  {...form.register('fixedCommissionAmount')}
                />
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Notes</label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
                {...form.register('commissionNotes')}
              />
            </div>
          </>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            Save settings
          </Button>
        </div>
      </form>
    </Modal>
  );
}
