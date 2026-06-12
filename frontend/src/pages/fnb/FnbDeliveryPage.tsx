import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Truck, Send, CreditCard, X, ArrowRight, MapPin, Phone, User } from 'lucide-react';
import {
  fetchOrders, sendOrder, settleOrder, cancelOrder, updateOrderDelivery, type Order,
} from '@/api/fnb-orders.api';
import { getApiErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/Modal';
import { TextInput, FieldLabel } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/error-banner';

const money = (v: number | string) => { const n = typeof v === 'string' ? Number(v) : v; return Number.isFinite(n) ? n.toFixed(2) : '0.00'; };
const ACTIVE = ['OPEN', 'SENT', 'READY', 'SERVED'];

export function FnbDeliveryPage() {
  const qc = useQueryClient();
  const [driverFor, setDriverFor] = useState<Order | null>(null);
  const [driver, setDriver] = useState('');

  const q = useQuery({ queryKey: ['fnb', 'orders'], queryFn: () => fetchOrders(), refetchInterval: 10000 });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['fnb', 'orders'] });
  const onErr = (e: unknown) => toast.error(getApiErrorMessage(e, 'Something went wrong'));

  const sendM = useMutation({ mutationFn: (id: string) => sendOrder(id), onSuccess: () => { invalidate(); toast.success('Sent to kitchen'); }, onError: onErr });
  const settleM = useMutation({ mutationFn: (id: string) => settleOrder(id, { paymentMethod: 'CASH' }), onSuccess: () => { invalidate(); toast.success('Delivery completed'); }, onError: onErr });
  const cancelM = useMutation({ mutationFn: (id: string) => cancelOrder(id), onSuccess: invalidate, onError: onErr });
  const driverM = useMutation({
    mutationFn: ({ id, driverName }: { id: string; driverName: string }) => updateOrderDelivery(id, { driverName }),
    onSuccess: () => { invalidate(); toast.success('Driver assigned'); setDriverFor(null); }, onError: onErr,
  });

  const all = q.data ?? [];
  const active = all.filter((o) => o.type === 'DELIVERY' && ACTIVE.includes(o.status));

  function card(o: Order) {
    const pending = o.items.filter((i) => i.status === 'PENDING').length;
    return (
      <div key={o.id} className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary-500" /><span className="font-semibold text-ink">{o.orderNumber}</span></div>
            <p className="mt-0.5 text-xs text-ink-muted">{o.items.length} item(s) · <Badge variant="muted">{o.status}</Badge></p>
          </div>
          <span className="text-sm font-semibold text-ink">{money(o.total)}</span>
        </div>

        <div className="mt-3 space-y-1 text-xs text-ink-muted">
          {o.deliveryAddress && <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3 w-3 shrink-0 text-ink-faint" /> {o.deliveryAddress}</p>}
          {o.deliveryPhone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-ink-faint" /> {o.deliveryPhone}</p>}
          <p className="flex items-center gap-1.5">
            <User className="h-3 w-3 text-ink-faint" />
            {o.driverName ? <span className="text-ink">{o.driverName}</span> : <span className="text-ink-faint">No driver</span>}
            <button onClick={() => { setDriver(o.driverName ?? ''); setDriverFor(o); }} className="ml-1 text-primary-600 hover:underline">{o.driverName ? 'change' : 'assign'}</button>
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={pending === 0 || sendM.isPending} onClick={() => sendM.mutate(o.id)}><Send className="h-3.5 w-3.5" /> Send</Button>
          <Button variant="primary" size="sm" disabled={settleM.isPending} onClick={() => settleM.mutate(o.id)}><CreditCard className="h-3.5 w-3.5" /> Complete</Button>
          <Button variant="ghost" size="sm" onClick={() => cancelM.mutate(o.id)}><X className="h-3.5 w-3.5" /> Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Delivery" description="Track delivery orders, assign drivers, and complete drop-offs."
        actions={<Link to="/fnb/pos"><Button variant="primary" size="md">New delivery <ArrowRight className="h-4 w-4" /></Button></Link>} />

      {q.isError && <ErrorBanner message={getApiErrorMessage(q.error, 'Failed to load delivery orders')} className="mb-6" />}

      {q.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : active.length === 0 ? (
        <EmptyState title="No active deliveries" description="Start a delivery order from the F&B POS — it will appear here to track, assign a driver, and complete." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{active.map(card)}</div>
      )}

      <Modal open={Boolean(driverFor)} title="Assign driver" onClose={() => setDriverFor(null)}
        footer={<div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="md" onClick={() => setDriverFor(null)} disabled={driverM.isPending}>Cancel</Button>
          <Button type="button" variant="primary" size="md" disabled={driverM.isPending || !driver.trim()}
            onClick={() => driverFor && driverM.mutate({ id: driverFor.id, driverName: driver.trim() })}>{driverM.isPending ? 'Saving…' : 'Assign'}</Button>
        </div>}>
        <div>
          <FieldLabel htmlFor="d-name" required>Driver name</FieldLabel>
          <TextInput id="d-name" value={driver} autoFocus onChange={(e) => setDriver(e.target.value)} placeholder="e.g. Omar" />
        </div>
      </Modal>
    </div>
  );
}
