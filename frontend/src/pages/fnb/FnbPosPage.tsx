import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, Send, CreditCard, X, UtensilsCrossed, Search } from 'lucide-react';
import {
  fetchOrders, openOrder, addOrderItem, updateOrderItem, removeOrderItem,
  sendOrder, settleOrder, cancelOrder, type Order, type OrderType,
} from '@/api/fnb-orders.api';
import { fetchMenuItems, type MenuItem } from '@/api/fnb-menu.api';
import { fetchTables, type RestaurantTable } from '@/api/fnb-tables.api';
import { fetchCategories } from '@/api/categories.api';
import { getApiErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/Modal';
import { TextInput, FieldLabel } from '@/components/ui/input';

const selectClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25';
const PAYMENTS = ['CASH', 'CARD', 'CREDIT', 'OTHER'];
const ACTIVE = ['OPEN', 'SENT', 'READY', 'SERVED'];
const money = (v: number | string) => { const n = typeof v === 'string' ? Number(v) : v; return Number.isFinite(n) ? n.toFixed(2) : '0.00'; };

function NewOrderModal({ open, tables, loading, onClose, onSubmit }: {
  open: boolean; tables: RestaurantTable[]; loading: boolean; onClose: () => void;
  onSubmit: (v: { type: OrderType; tableId?: string; guestCount?: number; deliveryAddress?: string; deliveryPhone?: string }) => void;
}) {
  const [type, setType] = useState<OrderType>('DINE_IN');
  const [tableId, setTableId] = useState('');
  const [guests, setGuests] = useState('2');
  const [addr, setAddr] = useState('');
  const [phone, setPhone] = useState('');
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (type === 'DINE_IN' && !tableId) { toast.error('Pick a table'); return; }
    onSubmit({ type, tableId: type === 'DINE_IN' ? tableId : undefined, guestCount: Number(guests) || 1, deliveryAddress: type === 'DELIVERY' ? addr.trim() || undefined : undefined, deliveryPhone: type === 'DELIVERY' ? phone.trim() || undefined : undefined });
  }
  return (
    <Modal open={open} title="New order" onClose={onClose}
      footer={<div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" form="new-order" variant="primary" size="md" disabled={loading}>{loading ? 'Opening…' : 'Open order'}</Button>
      </div>}>
      <form id="new-order" onSubmit={submit} className="space-y-4">
        <div>
          <FieldLabel htmlFor="o-type">Type</FieldLabel>
          <select id="o-type" className={selectClass} value={type} onChange={(e) => setType(e.target.value as OrderType)}>
            <option value="DINE_IN">Dine-in</option>
            <option value="TAKEAWAY">Takeaway</option>
            <option value="DELIVERY">Delivery</option>
          </select>
        </div>
        {type === 'DINE_IN' && (
          <div>
            <FieldLabel htmlFor="o-table">Table</FieldLabel>
            <select id="o-table" className={selectClass} value={tableId} onChange={(e) => setTableId(e.target.value)}>
              <option value="">Select a table…</option>
              {tables.map((t) => <option key={t.id} value={t.id}>{t.label}{t.status !== 'AVAILABLE' ? ` (${t.status.toLowerCase()})` : ''}</option>)}
            </select>
          </div>
        )}
        <div>
          <FieldLabel htmlFor="o-guests">Guests</FieldLabel>
          <TextInput id="o-guests" type="number" value={guests} onChange={(e) => setGuests(e.target.value)} />
        </div>
        {type === 'DELIVERY' && (
          <>
            <div>
              <FieldLabel htmlFor="o-addr">Delivery address</FieldLabel>
              <TextInput id="o-addr" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Street, building, notes" />
            </div>
            <div>
              <FieldLabel htmlFor="o-phone">Customer phone</FieldLabel>
              <TextInput id="o-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

export function FnbPosPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string>('');
  const [newOpen, setNewOpen] = useState(false);
  const [settleFor, setSettleFor] = useState<Order | null>(null);
  const [payment, setPayment] = useState('CASH');

  const ordersQ = useQuery({ queryKey: ['fnb', 'orders'], queryFn: () => fetchOrders() });
  const menuQ = useQuery({ queryKey: ['fnb', 'menu', 'pos'], queryFn: () => fetchMenuItems() });
  const catsQ = useQuery({ queryKey: ['categories', 'all'], queryFn: () => fetchCategories({ limit: 200 }) });
  const tablesQ = useQuery({ queryKey: ['fnb', 'tables'], queryFn: () => fetchTables() });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['fnb', 'orders'] });
    void qc.invalidateQueries({ queryKey: ['fnb', 'tables'] });
  };
  const onErr = (e: unknown) => toast.error(getApiErrorMessage(e, 'Something went wrong'));

  const openM = useMutation({ mutationFn: openOrder, onSuccess: (o) => { invalidate(); setSelectedId(o.id); setNewOpen(false); }, onError: onErr });
  const addM = useMutation({ mutationFn: (v: { id: string; menuItemId: string }) => addOrderItem(v.id, { menuItemId: v.menuItemId }), onSuccess: invalidate, onError: onErr });
  const qtyM = useMutation({ mutationFn: (v: { id: string; itemId: string; qty: number }) => updateOrderItem(v.id, v.itemId, v.qty), onSuccess: invalidate, onError: onErr });
  const rmM = useMutation({ mutationFn: (v: { id: string; itemId: string }) => removeOrderItem(v.id, v.itemId), onSuccess: invalidate, onError: onErr });
  const sendM = useMutation({ mutationFn: (id: string) => sendOrder(id), onSuccess: () => { invalidate(); toast.success('Sent to kitchen'); }, onError: onErr });
  const settleM = useMutation({ mutationFn: (v: { id: string; paymentMethod: string }) => settleOrder(v.id, { paymentMethod: v.paymentMethod }), onSuccess: () => { invalidate(); toast.success('Order settled'); setSettleFor(null); setSelectedId(null); }, onError: onErr });
  const cancelM = useMutation({ mutationFn: (id: string) => cancelOrder(id), onSuccess: () => { invalidate(); setSelectedId(null); }, onError: onErr });

  const orders = ordersQ.data ?? [];
  const activeOrders = orders.filter((o) => ACTIVE.includes(o.status));
  const selected = activeOrders.find((o) => o.id === selectedId) ?? null;
  const menu = menuQ.data ?? [];
  const categories = catsQ.data?.data ?? [];
  const tables = tablesQ.data ?? [];

  const filteredMenu = useMemo(() => menu.filter((m: MenuItem) =>
    m.isAvailable &&
    (!cat || m.categoryId === cat) &&
    (!search || m.name.toLowerCase().includes(search.toLowerCase())),
  ), [menu, cat, search]);

  const pendingCount = selected?.items.filter((i) => i.status === 'PENDING').length ?? 0;

  return (
    <div>
      <PageHeader
        title="F&B POS"
        description="Open a table or order, add menu items, send to the kitchen, and settle."
        actions={<Button variant="primary" size="md" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New order</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Menu / order picker */}
        <div>
          {/* Active orders strip */}
          <div className="mb-4 flex flex-wrap gap-2">
            {activeOrders.length === 0 && <p className="text-sm text-ink-faint">No open orders. Start one with “New order”.</p>}
            {activeOrders.map((o) => (
              <button key={o.id} onClick={() => setSelectedId(o.id)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                  selectedId === o.id ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-line bg-surface text-ink-muted hover:border-line-strong'
                }`}>
                <span className="font-semibold">{o.table?.label ?? o.type.replace('_', '-')}</span>
                <span className="ml-2 text-ink-faint">{money(o.total)}</span>
                <span className="ml-2">{o.status}</span>
              </button>
            ))}
          </div>

          {/* Search + categories */}
          <div className="mb-3 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu…" className="pl-9" />
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => setCat('')} className={`rounded-full border px-3 py-1 text-xs font-medium ${!cat ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-line bg-surface text-ink-muted'}`}>All</button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`rounded-full border px-3 py-1 text-xs font-medium ${cat === c.id ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-line bg-surface text-ink-muted'}`}>{c.name}</button>
            ))}
          </div>

          {menu.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-muted">
              No menu items yet. Add some under <span className="font-medium">Menu</span> first.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filteredMenu.map((m) => (
                <button key={m.id} disabled={!selected || addM.isPending}
                  onClick={() => selected && addM.mutate({ id: selected.id, menuItemId: m.id })}
                  className="flex flex-col items-start rounded-xl border border-line bg-surface p-3 text-left transition enabled:hover:border-primary-300 enabled:hover:bg-primary-50/40 disabled:cursor-not-allowed disabled:opacity-50">
                  <UtensilsCrossed className="h-4 w-4 text-primary-500" />
                  <span className="mt-2 line-clamp-2 text-sm font-medium text-ink">{m.name}</span>
                  <span className="mt-1 text-sm font-semibold text-ink-muted">{money(m.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="rounded-xl border border-line bg-surface p-4 lg:sticky lg:top-4 lg:self-start">
          {!selected ? (
            <div className="py-10 text-center text-sm text-ink-muted">
              <UtensilsCrossed className="mx-auto h-8 w-8 text-ink-faint" />
              <p className="mt-3">Select or open an order to start adding items.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink">{selected.table?.label ?? selected.type.replace('_', '-')}</p>
                  <p className="text-xs text-ink-faint">{selected.orderNumber} · <Badge variant="muted">{selected.status}</Badge></p>
                </div>
                <button title="Cancel order" onClick={() => cancelM.mutate(selected.id)} className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-50 hover:text-danger-600"><X className="h-4 w-4" /></button>
              </div>

              <div className="my-3 max-h-[40vh] space-y-2 overflow-auto">
                {selected.items.length === 0 && <p className="py-6 text-center text-sm text-ink-faint">No items yet — tap a menu item.</p>}
                {selected.items.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{it.name}</p>
                      <p className="text-xs text-ink-faint">{money(it.lineTotal)}{it.status !== 'PENDING' ? ` · ${it.status.toLowerCase()}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button disabled={it.quantity <= 1} onClick={() => qtyM.mutate({ id: selected.id, itemId: it.id, qty: it.quantity - 1 })} className="rounded p-1 text-ink-muted hover:bg-canvas disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-5 text-center text-sm">{it.quantity}</span>
                      <button onClick={() => qtyM.mutate({ id: selected.id, itemId: it.id, qty: it.quantity + 1 })} className="rounded p-1 text-ink-muted hover:bg-canvas"><Plus className="h-3.5 w-3.5" /></button>
                      <button onClick={() => rmM.mutate({ id: selected.id, itemId: it.id })} className="rounded p-1 text-ink-muted hover:bg-danger-50 hover:text-danger-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 border-t border-line pt-3 text-sm">
                <div className="flex justify-between text-ink-muted"><span>Subtotal</span><span>{money(selected.subtotal)}</span></div>
                <div className="flex justify-between text-ink-muted"><span>Tax</span><span>{money(selected.taxTotal)}</span></div>
                <div className="flex justify-between text-base font-semibold text-ink"><span>Total</span><span>{money(selected.total)}</span></div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="secondary" size="md" disabled={pendingCount === 0 || sendM.isPending} onClick={() => sendM.mutate(selected.id)}>
                  <Send className="h-4 w-4" /> Send{pendingCount ? ` (${pendingCount})` : ''}
                </Button>
                <Button variant="primary" size="md" disabled={selected.items.length === 0} onClick={() => { setPayment('CASH'); setSettleFor(selected); }}>
                  <CreditCard className="h-4 w-4" /> Settle
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <NewOrderModal open={newOpen} tables={tables} loading={openM.isPending}
        onClose={() => setNewOpen(false)} onSubmit={(v) => openM.mutate(v)} />

      <Modal open={Boolean(settleFor)} title="Settle order" onClose={() => setSettleFor(null)}
        footer={<div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="md" onClick={() => setSettleFor(null)} disabled={settleM.isPending}>Cancel</Button>
          <Button type="button" variant="primary" size="md" disabled={settleM.isPending}
            onClick={() => settleFor && settleM.mutate({ id: settleFor.id, paymentMethod: payment })}>
            {settleM.isPending ? 'Settling…' : `Charge ${settleFor ? money(settleFor.total) : ''}`}
          </Button>
        </div>}>
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">Total due <span className="font-semibold text-ink">{settleFor ? money(settleFor.total) : ''}</span></p>
          <div>
            <FieldLabel htmlFor="pay">Payment method</FieldLabel>
            <select id="pay" className={selectClass} value={payment} onChange={(e) => setPayment(e.target.value)}>
              {PAYMENTS.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
