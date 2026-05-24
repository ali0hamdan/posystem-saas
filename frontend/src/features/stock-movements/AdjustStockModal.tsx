import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/api/client';
import { adjustStock } from '@/api/stock-movements.api';
import type { ManualAdjustMovementType } from '@/types/stock-movement';
import type { Product } from '@/types/product';
import type { Resolver } from 'react-hook-form';

const schema = z.object({
  productId: z.string().uuid('Select a product'),
  direction: z.enum(['increase', 'decrease']),
  quantity: z
    .union([z.string(), z.number()])
    .transform((val) => {
      if (val === '' || val === null || val === undefined) return 0;
      const n = typeof val === 'number' ? val : Number(val);
      return Number.isFinite(n) ? Math.floor(n) : 0;
    })
    .pipe(z.number().int().min(1, 'At least 1')),
  movementType: z.enum(['ADJUSTMENT', 'DAMAGE', 'EXPIRED']),
  reason: z.string().min(1, 'Reason is required').max(2000),
});

type FormValues = z.infer<typeof schema>;

type AdjustStockModalProps = {
  open: boolean;
  onClose: () => void;
  products: Product[];
};

export function AdjustStockModal({ open, onClose, products }: AdjustStockModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      productId: '',
      direction: 'increase',
      quantity: 1,
      movementType: 'ADJUSTMENT',
      reason: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      productId: '',
      direction: 'increase',
      quantity: 1,
      movementType: 'ADJUSTMENT',
      reason: '',
    });
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: adjustStock,
    onSuccess: () => {
      toast.success('Stock updated');
      void queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not adjust stock'));
    },
  });

  const busy = mutation.isPending;
  const direction = form.watch('direction');

  function onSubmit(values: FormValues) {
    const qty = values.direction === 'increase' ? values.quantity : -values.quantity;
    mutation.mutate({
      productId: values.productId,
      quantityChange: qty,
      type: values.movementType as ManualAdjustMovementType,
      reason: values.reason.trim(),
    });
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Manual stock adjustment"
      description="Use for corrections, damage, or expiry. Sales and purchases create movements automatically."
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void form.handleSubmit(onSubmit)()}
            className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Apply adjustment'}
          </button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-ink">Product</label>
          <select
            {...form.register('productId')}
            className={cn(
              'w-full rounded-lg border bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-500/25',
              form.formState.errors.productId ? 'border-danger-400 focus:border-danger-400' : 'border-line focus:border-primary-400',
            )}
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (stock {p.quantity})
              </option>
            ))}
          </select>
          {form.formState.errors.productId ? (
            <p className="mt-1 text-xs text-danger-600">{form.formState.errors.productId.message}</p>
          ) : null}
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink">Direction</span>
          <input type="hidden" {...form.register('direction')} />
          <div className="flex rounded-lg border border-line p-1">
            {(['increase', 'decrease'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => form.setValue('direction', d, { shouldValidate: true })}
                className={cn(
                  'flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition',
                  direction === d ? 'bg-primary-600 text-white' : 'text-ink-muted hover:bg-canvas',
                )}
              >
                {d === 'increase' ? 'Increase' : 'Decrease'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Quantity</label>
          <input
            type="number"
            min={1}
            step={1}
            {...form.register('quantity')}
            className={cn(
              'w-full rounded-lg border bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-500/25',
              form.formState.errors.quantity ? 'border-danger-400 focus:border-danger-400' : 'border-line focus:border-primary-400',
            )}
          />
          {form.formState.errors.quantity ? (
            <p className="mt-1 text-xs text-danger-600">{form.formState.errors.quantity.message}</p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-ink">Movement type</label>
          <select
            {...form.register('movementType')}
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
          >
            <option value="ADJUSTMENT">Adjustment / count correction</option>
            <option value="DAMAGE">Damage</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-ink">Reason</label>
          <textarea
            rows={3}
            {...form.register('reason')}
            placeholder="Required for audit trail"
            className={cn(
              'w-full rounded-lg border bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-500/25',
              form.formState.errors.reason ? 'border-danger-400 focus:border-danger-400' : 'border-line focus:border-primary-400',
            )}
          />
          {form.formState.errors.reason ? (
            <p className="mt-1 text-xs text-danger-600">{form.formState.errors.reason.message}</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
