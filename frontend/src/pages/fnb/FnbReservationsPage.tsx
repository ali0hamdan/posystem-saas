import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Clock, Users, CalendarDays } from 'lucide-react';
import {
  fetchReservations, createReservation, updateReservation, setReservationStatus, deleteReservation,
  type Reservation, type ReservationStatus,
} from '@/api/fnb-reservations.api';
import { fetchTables } from '@/api/fnb-tables.api';
import { getApiErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TextInput, FieldLabel, FieldError } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/error-banner';

const selectClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25';
const STATUSES: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: 'Pending', CONFIRMED: 'Confirmed', SEATED: 'Seated', COMPLETED: 'Completed', CANCELLED: 'Cancelled', NO_SHOW: 'No-show',
};
const STATUS_CLASS: Record<ReservationStatus, string> = {
  PENDING: 'bg-canvas text-ink-muted border-line',
  CONFIRMED: 'bg-primary-50 text-primary-700 border-primary-100',
  SEATED: 'bg-success-50 text-success-700 border-success-100',
  COMPLETED: 'bg-canvas text-ink-faint border-line',
  CANCELLED: 'bg-danger-50 text-danger-700 border-danger-100',
  NO_SHOW: 'bg-warning-50 text-warning-700 border-warning-100',
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const toLocalInput = (iso: string) => { const d = new Date(iso); const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16); };
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

type Form = { customerName: string; customerPhone: string; partySize: string; reservedAt: string; durationMin: string; tableId: string; notes: string };

function ReservationModal({ open, initial, tables, defaultDate, loading, onClose, onSubmit }: {
  open: boolean; initial?: Reservation; tables: { id: string; label: string }[]; defaultDate: string;
  loading: boolean; onClose: () => void; onSubmit: (v: Form) => void;
}) {
  const [form, setForm] = useState<Form>(initial ? {
    customerName: initial.customerName, customerPhone: initial.customerPhone ?? '', partySize: String(initial.partySize),
    reservedAt: toLocalInput(initial.reservedAt), durationMin: String(initial.durationMin), tableId: initial.tableId ?? '', notes: initial.notes ?? '',
  } : { customerName: '', customerPhone: '', partySize: '2', reservedAt: `${defaultDate}T19:00`, durationMin: '90', tableId: '', notes: '' });
  const [err, setErr] = useState<{ name?: string; when?: string }>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof err = {};
    if (!form.customerName.trim()) next.name = 'Name is required';
    if (!form.reservedAt) next.when = 'Pick a date & time';
    setErr(next);
    if (Object.keys(next).length === 0) onSubmit(form);
  }

  return (
    <Modal open={open} title={initial ? 'Edit reservation' : 'New reservation'} onClose={onClose}
      footer={<div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" form="res-form" variant="primary" size="md" disabled={loading}>{loading ? 'Saving…' : initial ? 'Save' : 'Book'}</Button>
      </div>}>
      <form id="res-form" onSubmit={submit} className="space-y-4">
        <div>
          <FieldLabel htmlFor="r-name" required>Guest name</FieldLabel>
          <TextInput id="r-name" value={form.customerName} autoFocus error={err.name}
            onChange={(e) => { setForm((p) => ({ ...p, customerName: e.target.value })); setErr((p) => ({ ...p, name: undefined })); }} placeholder="e.g. Sarah K." />
          <FieldError message={err.name} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><FieldLabel htmlFor="r-phone">Phone</FieldLabel>
            <TextInput id="r-phone" value={form.customerPhone} onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))} placeholder="Optional" /></div>
          <div><FieldLabel htmlFor="r-party">Party size</FieldLabel>
            <TextInput id="r-party" type="number" value={form.partySize} onChange={(e) => setForm((p) => ({ ...p, partySize: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="r-when" required>Date & time</FieldLabel>
            <input id="r-when" type="datetime-local" className={selectClass} value={form.reservedAt}
              onChange={(e) => { setForm((p) => ({ ...p, reservedAt: e.target.value })); setErr((p) => ({ ...p, when: undefined })); }} />
            <FieldError message={err.when} />
          </div>
          <div><FieldLabel htmlFor="r-dur">Duration (min)</FieldLabel>
            <TextInput id="r-dur" type="number" value={form.durationMin} onChange={(e) => setForm((p) => ({ ...p, durationMin: e.target.value }))} /></div>
        </div>
        <div>
          <FieldLabel htmlFor="r-table">Table</FieldLabel>
          <select id="r-table" className={selectClass} value={form.tableId} onChange={(e) => setForm((p) => ({ ...p, tableId: e.target.value }))}>
            <option value="">No table yet</option>
            {tables.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div><FieldLabel htmlFor="r-notes">Notes</FieldLabel>
          <TextInput id="r-notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" /></div>
      </form>
    </Modal>
  );
}

export function FnbReservationsPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const [modal, setModal] = useState<{ open: boolean; edit?: Reservation }>({ open: false });
  const [del, setDel] = useState<Reservation | null>(null);

  const q = useQuery({ queryKey: ['fnb', 'reservations', date], queryFn: () => fetchReservations({ date }) });
  const tablesQ = useQuery({ queryKey: ['fnb', 'tables'], queryFn: () => fetchTables() });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['fnb', 'reservations'] });
  const onErr = (e: unknown) => toast.error(getApiErrorMessage(e, 'Something went wrong'));

  const createM = useMutation({ mutationFn: createReservation, onSuccess: () => { toast.success('Reservation booked'); invalidate(); setModal({ open: false }); }, onError: onErr });
  const updateM = useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => updateReservation(id, body), onSuccess: () => { toast.success('Reservation updated'); invalidate(); setModal({ open: false }); }, onError: onErr });
  const statusM = useMutation({ mutationFn: ({ id, status }: { id: string; status: ReservationStatus }) => setReservationStatus(id, status), onSuccess: invalidate, onError: onErr });
  const delM = useMutation({ mutationFn: (id: string) => deleteReservation(id), onSuccess: () => { toast.success('Reservation removed'); invalidate(); setDel(null); }, onError: onErr });

  const list = q.data ?? [];
  const tables = (tablesQ.data ?? []).map((t) => ({ id: t.id, label: t.label }));

  function submit(v: Form) {
    const body = {
      customerName: v.customerName.trim(), customerPhone: v.customerPhone.trim() || undefined,
      partySize: Number(v.partySize) || 1, reservedAt: new Date(v.reservedAt).toISOString(),
      durationMin: Number(v.durationMin) || 90, tableId: v.tableId || null, notes: v.notes.trim() || undefined,
    };
    if (modal.edit) updateM.mutate({ id: modal.edit.id, body });
    else createM.mutate(body);
  }

  return (
    <div>
      <PageHeader title="Reservations" description="Book and manage table reservations."
        actions={<Button variant="primary" size="md" onClick={() => setModal({ open: true })}><Plus className="h-4 w-4" /> New reservation</Button>} />

      <div className="mb-6 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-ink-faint" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none" />
      </div>

      {q.isError && <ErrorBanner message={getApiErrorMessage(q.error, 'Failed to load reservations')} className="mb-6" />}

      {q.isPending ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState title="No reservations" description="No bookings for this day. Add one with “New reservation”." />
      ) : (
        <div className="space-y-2">
          {list.map((r) => (
            <div key={r.id} className="group flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Clock className="h-4 w-4 text-primary-500" /> {timeOf(r.reservedAt)}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{r.customerName}</p>
                <p className="flex items-center gap-3 text-xs text-ink-muted">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {r.partySize}</span>
                  {r.table && <span>Table {r.table.label}</span>}
                  {r.customerPhone && <span>{r.customerPhone}</span>}
                </p>
              </div>
              <select aria-label="Status" className={`cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}
                value={r.status} onChange={(e) => statusM.mutate({ id: r.id, status: e.target.value as ReservationStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button title="Edit" onClick={() => setModal({ open: true, edit: r })} className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"><Pencil className="h-4 w-4" /></button>
                <button title="Remove" onClick={() => setDel(r)} className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-50 hover:text-danger-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <ReservationModal open={modal.open} initial={modal.edit} tables={tables} defaultDate={date}
          loading={createM.isPending || updateM.isPending} onClose={() => setModal({ open: false })} onSubmit={submit} />
      )}
      <ConfirmDialog open={Boolean(del)} title="Remove reservation"
        description={`${del?.customerName}'s booking will be removed.`} confirmLabel="Remove" variant="danger" loading={delM.isPending}
        onConfirm={() => del && delM.mutate(del.id)} onCancel={() => setDel(null)} />
    </div>
  );
}
