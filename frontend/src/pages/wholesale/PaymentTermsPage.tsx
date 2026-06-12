import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCustomerCreditProfiles, upsertCustomerCreditProfile } from '@/api/wholesale/customer-credit.api';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { TextInput } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';

export function PaymentTermsPage() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [creditLimit, setCreditLimit] = useState('0');
  const [termsDays, setTermsDays] = useState('30');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['wholesale', 'credit-profiles'],
    queryFn: listCustomerCreditProfiles,
  });

  const saveM = useMutation({
    mutationFn: () =>
      upsertCustomerCreditProfile(editId!, {
        creditLimit: Number(creditLimit) || 0,
        paymentTermsDays: Number(termsDays) || 0,
      }),
    onSuccess: () => {
      setEditId(null);
      void qc.invalidateQueries({ queryKey: ['wholesale', 'credit-profiles'] });
    },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const selected = data?.find((c) => c.id === editId);

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Payment terms & credit"
        description="Set credit limits and Net payment terms for wholesale customers."
      />
      {error && <div className="rounded-lg border border-danger-300 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}
      {isLoading ? <p className="text-sm text-ink-muted">Loading…</p> : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-sm">
            <thead className="bg-canvas-raised text-left text-ink-muted">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Balance</th>
                <th className="px-3 py-2">Credit limit</th>
                <th className="px-3 py-2">Terms (days)</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">${c.balance}</td>
                  <td className="px-3 py-2">${c.creditProfile?.creditLimit ?? '0'}</td>
                  <td className="px-3 py-2">{c.creditProfile?.paymentTermsDays ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditId(c.id);
                        setCreditLimit(c.creditProfile?.creditLimit ?? '0');
                        setTermsDays(String(c.creditProfile?.paymentTermsDays ?? 30));
                      }}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        open={Boolean(editId)}
        title={`Credit profile — ${selected?.name ?? ''}`}
        onClose={() => setEditId(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditId(null)}>Cancel</Button>
            <Button variant="primary" disabled={saveM.isPending} onClick={() => saveM.mutate()}>Save</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-ink-muted">Credit limit</label>
            <TextInput type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-muted">Payment terms (days)</label>
            <TextInput type="number" value={termsDays} onChange={(e) => setTermsDays(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
