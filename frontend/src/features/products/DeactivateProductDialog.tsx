import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { getApiErrorMessage } from '@/api/client';
import { deactivateProduct } from '@/api/products.api';
import type { Product } from '@/types/product';

type DeactivateProductDialogProps = {
  product: Product | null;
  open: boolean;
  onClose: () => void;
};

export function DeactivateProductDialog({ product, open, onClose }: DeactivateProductDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) => deactivateProduct(id),
    onSuccess: () => {
      toast.success('Product deactivated');
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not deactivate product'));
    },
  });

  const busy = mutation.isPending;

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Deactivate product?"
      description={
        product
          ? `“${product.name}” will be hidden from cashiers and POS lookups. You can reactivate it later from the product list.`
          : undefined
      }
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
            disabled={busy || !product}
            onClick={() => product && mutation.mutate(product.id)}
            className="rounded-lg bg-danger-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-danger-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      }
    >
      <p className="text-sm text-ink-muted">This is a soft delete: inventory history is kept.</p>
    </Modal>
  );
}
