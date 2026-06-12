import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  cancelDeliveryNote,
  listDeliveryNotes,
  markDeliveryNoteDelivered,
} from '@/api/wholesale/delivery-notes.api';
import { fetchCustomers } from '@/api/customers.api';
import { customerPickerLabel } from '@/lib/customer-display';
import { fetchProducts } from '@/api/products.api';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/input';
import { createDeliveryNote } from '@/api/wholesale/delivery-notes.api';

export function DeliveryNotesPage() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const { data, isLoading } = useQuery({
    queryKey: ['wholesale', 'delivery-notes'],
    queryFn: () => listDeliveryNotes({ limit: 50 }),
  });

  const customersQ = useQuery({
    queryKey: ['customers', 'dn'],
    queryFn: () => fetchCustomers({ limit: 100 }),
    enabled: open,
  });

  const productsQ = useQuery({
    queryKey: ['products', 'dn'],
    queryFn: () => fetchProducts({ limit: 100 }),
    enabled: open,
  });

  const createM = useMutation({
    mutationFn: () =>
      createDeliveryNote({
        customerId,
        items: [{ productId, quantity: Math.max(1, Number(quantity) || 1) }],
      }),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['wholesale', 'delivery-notes'] });
    },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const deliverM = useMutation({
    mutationFn: markDeliveryNoteDelivered,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['wholesale', 'delivery-notes'] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const cancelM = useMutation({
    mutationFn: cancelDeliveryNote,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['wholesale', 'delivery-notes'] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Delivery notes"
        description="Delivery documents for B2B shipments. Not revenue until tied to an official invoice."
        actions={<Button onClick={() => setOpen(true)}>New delivery note</Button>}
      />
      {error && <div className="rounded-lg border border-danger-300 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}
      {isLoading ? <p className="text-sm text-ink-muted">Loading…</p> : (
        <div className="space-y-2">
          {rows.map((dn) => (
            <div key={dn.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface p-4">
              <div>
                <p className="font-medium text-ink">{dn.deliveryNoteNumber}</p>
                <p className="text-xs text-ink-muted">{format(new Date(dn.createdAt), 'PPp')} · {dn.items.length} items</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{dn.status}</Badge>
                {dn.status !== 'DELIVERED' && dn.status !== 'CANCELLED' && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => deliverM.mutate(dn.id)}>Mark delivered</Button>
                    <Button size="sm" variant="ghost" onClick={() => cancelM.mutate(dn.id)}>Cancel</Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-ink-muted">No delivery notes yet.</p>}
        </div>
      )}
      <Modal
        open={open}
        title="New delivery note"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!customerId || !productId || createM.isPending}
              onClick={() => createM.mutate()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <select className="w-full rounded-lg border border-line px-3 py-2 text-sm" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer</option>
            {(customersQ.data?.data ?? []).map((c) => <option key={c.id} value={c.id}>{customerPickerLabel(c)}</option>)}
          </select>
          <select className="w-full rounded-lg border border-line px-3 py-2 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select product</option>
            {(productsQ.data?.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <TextInput type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" />
        </div>
      </Modal>
    </div>
  );
}
