import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import type { CustomerFormBody, CustomerRow } from '@/types/customers';
import { useBusinessType } from '@/hooks/use-tenant-context';

const inputClass =
  'h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25';

const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted';

export const emptyCustomerForm = (): CustomerFormBody => ({
  name: '',
  phone: '',
  email: '',
  address: '',
  companyName: '',
  taxNumber: '',
  paymentTermsDays: undefined,
  creditLimit: undefined,
  notes: '',
  isActive: true,
});

export function customerToForm(c: CustomerRow): CustomerFormBody {
  return {
    name: c.name,
    phone: c.phone ?? '',
    email: c.email ?? '',
    address: c.address ?? '',
    companyName: c.companyName ?? '',
    taxNumber: c.taxNumber ?? '',
    paymentTermsDays: c.paymentTermsDays ?? undefined,
    creditLimit: c.creditLimit != null ? Number(c.creditLimit) : undefined,
    notes: c.notes ?? '',
    isActive: c.isActive,
  };
}

type Props = {
  open: boolean;
  title: string;
  description?: string;
  initial?: CustomerFormBody;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (body: CustomerFormBody) => void;
};

export function CustomerFormModal({ open, title, description, initial, saving, onClose, onSubmit }: Props) {
  const businessType = useBusinessType();
  const showB2b = businessType === 'WHOLESALE' || businessType === 'HYBRID';
  const [form, setForm] = useState<CustomerFormBody>(emptyCustomerForm());

  useEffect(() => {
    if (open) setForm(initial ?? emptyCustomerForm());
  }, [open, initial]);

  function set<K extends keyof CustomerFormBody>(key: K, value: CustomerFormBody[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit() {
    onSubmit({
      ...form,
      name: form.name.trim(),
      phone: form.phone?.trim() || undefined,
      email: form.email?.trim() || undefined,
      address: form.address?.trim() || undefined,
      companyName: form.companyName?.trim() || undefined,
      taxNumber: form.taxNumber?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      paymentTermsDays:
        form.paymentTermsDays != null && !Number.isNaN(Number(form.paymentTermsDays))
          ? Math.max(0, Math.trunc(Number(form.paymentTermsDays)))
          : undefined,
      creditLimit:
        form.creditLimit != null && !Number.isNaN(Number(form.creditLimit))
          ? Math.max(0, Number(form.creditLimit))
          : undefined,
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={title}
      description={description}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" variant="primary" disabled={saving || !form.name.trim()} onClick={handleSubmit}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-ink">Basic info</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={labelClass}>Name *</span>
              <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="block">
              <span className={labelClass}>Phone</span>
              <input className={inputClass} value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </label>
            <label className="block">
              <span className={labelClass}>Email</span>
              <input type="email" className={inputClass} value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>Address</span>
              <textarea
                rows={2}
                className={inputClass}
                value={form.address ?? ''}
                onChange={(e) => set('address', e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => set('isActive', e.target.checked)} />
              Active customer
            </label>
          </div>
        </section>

        {showB2b ? (
          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink">Wholesale / B2B</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Company name</span>
                <input className={inputClass} value={form.companyName ?? ''} onChange={(e) => set('companyName', e.target.value)} />
              </label>
              <label className="block">
                <span className={labelClass}>Tax / VAT number</span>
                <input className={inputClass} value={form.taxNumber ?? ''} onChange={(e) => set('taxNumber', e.target.value)} />
              </label>
              <label className="block">
                <span className={labelClass}>Payment terms (days)</span>
                <TextInput type="number" min={0} value={form.paymentTermsDays ?? ''} onChange={(e) => set('paymentTermsDays', e.target.value ? Number(e.target.value) : undefined)} />
              </label>
              <label className="block">
                <span className={labelClass}>Credit limit</span>
                <TextInput type="number" min={0} step="0.01" value={form.creditLimit ?? ''} onChange={(e) => set('creditLimit', e.target.value ? Number(e.target.value) : undefined)} />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClass}>Notes</span>
                <textarea rows={3} className={inputClass} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
              </label>
            </div>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
