import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, LayoutGrid, Users } from 'lucide-react';
import {
  fetchDiningAreas, createDiningArea, updateDiningArea, deleteDiningArea,
  fetchTables, createTable, updateTable, setTableStatus, deleteTable,
  type DiningArea, type RestaurantTable, type TableStatus,
} from '@/api/fnb-tables.api';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TextInput, FieldLabel, FieldError } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/error-banner';

const UNASSIGNED = '__none__';
const STATUSES: TableStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'];
const STATUS_LABEL: Record<TableStatus, string> = {
  AVAILABLE: 'Available', OCCUPIED: 'Occupied', RESERVED: 'Reserved', OUT_OF_SERVICE: 'Out of service',
};
const STATUS_CLASS: Record<TableStatus, string> = {
  AVAILABLE: 'bg-success-50 text-success-700 border-success-100',
  OCCUPIED: 'bg-warning-50 text-warning-700 border-warning-100',
  RESERVED: 'bg-primary-50 text-primary-700 border-primary-100',
  OUT_OF_SERVICE: 'bg-canvas text-ink-muted border-line',
};
const selectClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25';

type TableForm = { label: string; seats: string; diningAreaId: string; status: TableStatus };

function TableFormModal({ open, initial, areas, defaultAreaId, loading, onClose, onSubmit }: {
  open: boolean; initial?: RestaurantTable; areas: DiningArea[]; defaultAreaId: string; loading: boolean;
  onClose: () => void; onSubmit: (v: TableForm) => void;
}) {
  const [form, setForm] = useState<TableForm>(initial
    ? { label: initial.label, seats: String(initial.seats), diningAreaId: initial.diningAreaId ?? defaultAreaId, status: initial.status }
    : { label: '', seats: '2', diningAreaId: defaultAreaId, status: 'AVAILABLE' });
  const [err, setErr] = useState<{ label?: string; area?: string }>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof err = {};
    if (!form.label.trim()) next.label = 'Label is required';
    if (!form.diningAreaId) next.area = 'Choose a dining area';
    setErr(next);
    if (Object.keys(next).length === 0) onSubmit(form);
  }

  return (
    <Modal open={open} title={initial ? 'Edit table' : 'New table'} onClose={onClose}
      footer={<div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" form="table-form" variant="primary" size="md" disabled={loading}>
          {loading ? 'Saving…' : initial ? 'Save changes' : 'Create table'}
        </Button>
      </div>}>
      <form id="table-form" onSubmit={submit} className="space-y-4">
        <div>
          <FieldLabel htmlFor="t-label" required>Label</FieldLabel>
          <TextInput id="t-label" value={form.label} autoFocus error={err.label}
            onChange={(e) => { setForm((p) => ({ ...p, label: e.target.value })); setErr((p) => ({ ...p, label: undefined })); }}
            placeholder="e.g. T1 / 4" />
          <FieldError message={err.label} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="t-seats">Seats</FieldLabel>
            <TextInput id="t-seats" type="number" value={form.seats}
              onChange={(e) => setForm((p) => ({ ...p, seats: e.target.value }))} />
          </div>
          <div>
            <FieldLabel htmlFor="t-status">Status</FieldLabel>
            <select id="t-status" className={selectClass} value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as TableStatus }))}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="t-area" required>Dining area</FieldLabel>
          <select id="t-area" className={selectClass} value={form.diningAreaId}
            onChange={(e) => { setForm((p) => ({ ...p, diningAreaId: e.target.value })); setErr((p) => ({ ...p, area: undefined })); }}>
            <option value="">Select an area…</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <FieldError message={err.area} />
        </div>
      </form>
    </Modal>
  );
}

function AreaFormModal({ open, initial, loading, onClose, onSubmit }: {
  open: boolean; initial?: DiningArea; loading: boolean; onClose: () => void; onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [err, setErr] = useState('');
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr('Name is required'); return; }
    onSubmit(name.trim());
  }
  return (
    <Modal open={open} title={initial ? 'Edit area' : 'New dining area'} onClose={onClose}
      footer={<div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" form="area-form" variant="primary" size="md" disabled={loading}>
          {loading ? 'Saving…' : initial ? 'Save' : 'Create area'}
        </Button>
      </div>}>
      <form id="area-form" onSubmit={submit} className="space-y-4">
        <div>
          <FieldLabel htmlFor="a-name" required>Name</FieldLabel>
          <TextInput id="a-name" value={name} autoFocus error={err}
            onChange={(e) => { setName(e.target.value); setErr(''); }} placeholder="e.g. Main hall / Patio" />
          <FieldError message={err} />
        </div>
      </form>
    </Modal>
  );
}

export function FnbTablesPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [activeArea, setActiveArea] = useState<string>('');
  const [tableModal, setTableModal] = useState<{ open: boolean; edit?: RestaurantTable }>({ open: false });
  const [areaModal, setAreaModal] = useState<{ open: boolean; edit?: DiningArea }>({ open: false });
  const [delTable, setDelTable] = useState<RestaurantTable | null>(null);
  const [delArea, setDelArea] = useState<DiningArea | null>(null);

  const areasQ = useQuery({ queryKey: ['fnb', 'areas'], queryFn: () => fetchDiningAreas() });
  const tablesQ = useQuery({ queryKey: ['fnb', 'tables'], queryFn: () => fetchTables() });

  const areas = areasQ.data ?? [];
  const tables = tablesQ.data ?? [];
  const unassigned = tables.filter((t) => !t.diningAreaId);

  // Default the active tab to the first area (or Unassigned if only orphans exist).
  useEffect(() => {
    if (activeArea) return;
    if (areas.length > 0) setActiveArea(areas[0].id);
    else if (unassigned.length > 0) setActiveArea(UNASSIGNED);
  }, [areas, unassigned.length, activeArea]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['fnb', 'tables'] });
    void qc.invalidateQueries({ queryKey: ['fnb', 'areas'] });
  };
  const onErr = (e: unknown) => toast.error(getApiErrorMessage(e, 'Something went wrong'));

  const createTableM = useMutation({ mutationFn: createTable, onSuccess: () => { toast.success('Table created'); invalidate(); setTableModal({ open: false }); }, onError: onErr });
  const updateTableM = useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => updateTable(id, body), onSuccess: () => { toast.success('Table updated'); invalidate(); setTableModal({ open: false }); }, onError: onErr });
  const statusM = useMutation({ mutationFn: ({ id, status }: { id: string; status: TableStatus }) => setTableStatus(id, status), onSuccess: invalidate, onError: onErr });
  const delTableM = useMutation({ mutationFn: (id: string) => deleteTable(id), onSuccess: () => { toast.success('Table removed'); invalidate(); setDelTable(null); }, onError: onErr });
  const createAreaM = useMutation({ mutationFn: createDiningArea, onSuccess: (a) => { toast.success('Area created'); invalidate(); setAreaModal({ open: false }); setActiveArea(a.id); }, onError: onErr });
  const updateAreaM = useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => updateDiningArea(id, { name }), onSuccess: () => { toast.success('Area updated'); invalidate(); setAreaModal({ open: false }); }, onError: onErr });
  const delAreaM = useMutation({ mutationFn: (id: string) => deleteDiningArea(id), onSuccess: () => { toast.success('Area removed'); invalidate(); setDelArea(null); setActiveArea(''); }, onError: onErr });

  const loading = areasQ.isPending || tablesQ.isPending;
  const currentTables = activeArea === UNASSIGNED ? unassigned : tables.filter((t) => t.diningAreaId === activeArea);
  const selectedArea = areas.find((a) => a.id === activeArea) ?? null;

  function startNewTable() {
    if (areas.length === 0) { toast.error('Create a dining area first'); setAreaModal({ open: true }); return; }
    setTableModal({ open: true });
  }
  function submitTable(v: TableForm) {
    const body = { label: v.label.trim(), seats: Number(v.seats) || 1, diningAreaId: v.diningAreaId, status: v.status };
    if (tableModal.edit) updateTableM.mutate({ id: tableModal.edit.id, body });
    else createTableM.mutate(body);
  }

  return (
    <div>
      <PageHeader
        title="Tables"
        description="Pick a dining area to manage its tables and status."
        actions={canManage ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={() => setAreaModal({ open: true })}>
              <LayoutGrid className="h-4 w-4" /> New area
            </Button>
            <Button variant="primary" size="md" onClick={startNewTable}>
              <Plus className="h-4 w-4" /> New table
            </Button>
          </div>
        ) : undefined}
      />

      {(areasQ.isError || tablesQ.isError) && (
        <ErrorBanner message={getApiErrorMessage(areasQ.error ?? tablesQ.error, 'Failed to load tables')} className="mb-6" />
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : areas.length === 0 && unassigned.length === 0 ? (
        <EmptyState
          title="No dining areas yet"
          description={canManage ? 'Create your first dining area, then add tables to it.' : 'No tables have been set up.'}
          action={canManage ? (
            <Button variant="primary" size="md" onClick={() => setAreaModal({ open: true })}>
              <LayoutGrid className="h-4 w-4" /> New area
            </Button>
          ) : undefined}
        />
      ) : (
        <>
          {/* Area tabs */}
          <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-line pb-3">
            {areas.map((a) => (
              <button key={a.id} onClick={() => setActiveArea(a.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  activeArea === a.id ? 'bg-primary-600 text-white' : 'text-ink-muted hover:bg-canvas-raised hover:text-ink'
                }`}>
                {a.name}
                <span className={`ml-2 text-xs ${activeArea === a.id ? 'text-white/70' : 'text-ink-faint'}`}>{a._count?.tables ?? 0}</span>
              </button>
            ))}
            {unassigned.length > 0 && (
              <button onClick={() => setActiveArea(UNASSIGNED)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  activeArea === UNASSIGNED ? 'bg-primary-600 text-white' : 'text-ink-muted hover:bg-canvas-raised hover:text-ink'
                }`}>
                Unassigned <span className="ml-1 text-xs">{unassigned.length}</span>
              </button>
            )}
            {canManage && selectedArea && (
              <div className="ml-auto flex items-center gap-1">
                <button title="Rename area" onClick={() => setAreaModal({ open: true, edit: selectedArea })}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"><Pencil className="h-4 w-4" /></button>
                <button title="Delete area" onClick={() => setDelArea(selectedArea)}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-50 hover:text-danger-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            )}
          </div>

          {currentTables.length === 0 ? (
            <EmptyState
              title="No tables in this area"
              description={canManage ? 'Add tables to this area to start seating guests.' : 'No tables here yet.'}
              action={canManage && activeArea !== UNASSIGNED ? (
                <Button variant="primary" size="md" onClick={startNewTable}><Plus className="h-4 w-4" /> New table</Button>
              ) : undefined}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {currentTables.map((t) => (
                <div key={t.id} className="group rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-ink">{t.label}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted"><Users className="h-3 w-3" /> {t.seats} seats</p>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button title="Edit" onClick={() => setTableModal({ open: true, edit: t })}
                          className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"><Pencil className="h-3.5 w-3.5" /></button>
                        <button title="Remove" onClick={() => setDelTable(t)}
                          className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-50 hover:text-danger-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>
                  <select aria-label="Table status"
                    className={`mt-3 w-full cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-medium ${STATUS_CLASS[t.status]}`}
                    value={t.status}
                    onChange={(e) => statusM.mutate({ id: t.id, status: e.target.value as TableStatus })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tableModal.open && (
        <TableFormModal
          open={tableModal.open}
          initial={tableModal.edit}
          areas={areas}
          defaultAreaId={tableModal.edit?.diningAreaId ?? (activeArea !== UNASSIGNED ? activeArea : areas[0]?.id ?? '')}
          loading={createTableM.isPending || updateTableM.isPending}
          onClose={() => setTableModal({ open: false })}
          onSubmit={submitTable}
        />
      )}
      {areaModal.open && (
        <AreaFormModal
          open={areaModal.open}
          initial={areaModal.edit}
          loading={createAreaM.isPending || updateAreaM.isPending}
          onClose={() => setAreaModal({ open: false })}
          onSubmit={(name) => (areaModal.edit ? updateAreaM.mutate({ id: areaModal.edit.id, name }) : createAreaM.mutate({ name }))}
        />
      )}

      <ConfirmDialog
        open={Boolean(delTable)}
        title="Remove table"
        description={`"${delTable?.label}" will be permanently removed.`}
        confirmLabel="Remove" variant="danger" loading={delTableM.isPending}
        onConfirm={() => delTable && delTableM.mutate(delTable.id)}
        onCancel={() => setDelTable(null)}
      />
      <ConfirmDialog
        open={Boolean(delArea)}
        title="Delete dining area"
        description={`"${delArea?.name}" will be deleted. Remove its tables first if it still has any.`}
        confirmLabel="Delete" variant="danger" loading={delAreaM.isPending}
        onConfirm={() => delArea && delAreaM.mutate(delArea.id)}
        onCancel={() => setDelArea(null)}
      />
    </div>
  );
}
