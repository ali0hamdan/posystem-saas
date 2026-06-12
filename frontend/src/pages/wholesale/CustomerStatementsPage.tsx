import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fetchCustomerStatement } from '@/api/wholesale/customer-credit.api';
import { fetchCustomers } from '@/api/customers.api';
import { customerPickerLabel } from '@/lib/customer-display';
import { useStoreSettings } from '@/hooks/use-store-settings';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { TextInput } from '@/components/ui/input';

export function CustomerStatementsPage() {
  const { formatMoney: fmt } = useStoreSettings();
  const [customerId, setCustomerId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const customersQ = useQuery({
    queryKey: ['customers', 'statement'],
    queryFn: () => fetchCustomers({ limit: 200 }),
  });

  const statementQ = useQuery({
    queryKey: ['wholesale', 'statement', customerId, from, to],
    queryFn: () => fetchCustomerStatement(customerId, from || undefined, to || undefined),
    enabled: Boolean(customerId),
  });

  const stmt = statementQ.data as {
    customer?: {
      name: string;
      companyName?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      taxNumber?: string | null;
      currentBalance: string;
    };
    openingBalance?: string;
    closingBalance?: string;
    entries?: { type: string; amount: string; balanceAfter: string; createdAt: string; note: string | null }[];
    unpaidInvoices?: { invoiceNumber: string; outstanding: string; createdAt: string }[];
  } | undefined;

  return (
    <div className="space-y-4 p-4">
      <PageHeader title="Customer statements" description="View account activity, balances, and unpaid invoices." />
      <div className="flex flex-wrap gap-2 rounded-xl border border-line bg-surface p-4">
        <select className="min-w-[200px] rounded-lg border border-line px-3 py-2 text-sm" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Select customer</option>
          {(customersQ.data?.data ?? []).map((c) => <option key={c.id} value={c.id}>{customerPickerLabel(c)}</option>)}
        </select>
        <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button variant="secondary" onClick={() => void statementQ.refetch()} disabled={!customerId}>
          Refresh
        </Button>
      </div>
      {statementQ.isLoading && customerId ? <p className="text-sm text-ink-muted">Loading statement…</p> : null}
      {stmt?.customer && (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="font-semibold text-ink">
              {stmt.customer.companyName && stmt.customer.companyName !== stmt.customer.name
                ? `${stmt.customer.name} · ${stmt.customer.companyName}`
                : stmt.customer.name}
            </p>
            <dl className="mt-2 grid gap-1 text-sm text-ink-muted sm:grid-cols-2">
              {stmt.customer.phone ? <div>Phone: {stmt.customer.phone}</div> : null}
              {stmt.customer.email ? <div>Email: {stmt.customer.email}</div> : null}
              {stmt.customer.address ? <div className="sm:col-span-2">Address: {stmt.customer.address}</div> : null}
              {stmt.customer.taxNumber ? <div>Tax/VAT: {stmt.customer.taxNumber}</div> : null}
            </dl>
            <p className="mt-3 text-sm text-ink-muted">
              Opening {fmt(Number(stmt.openingBalance))} · Closing {fmt(Number(stmt.closingBalance))} · Current {fmt(Number(stmt.customer.currentBalance))}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold">Ledger entries</h3>
            <ul className="space-y-1 text-sm">
              {(stmt.entries ?? []).map((e, i) => (
                <li key={i} className="flex justify-between">
                  <span>{format(new Date(e.createdAt), 'PP')} · {e.type}</span>
                  <span>{fmt(Number(e.amount))} → {fmt(Number(e.balanceAfter))}</span>
                </li>
              ))}
              {(stmt.entries ?? []).length === 0 && <li className="text-ink-muted">No entries in range.</li>}
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold">Unpaid invoices</h3>
            <ul className="space-y-1 text-sm">
              {(stmt.unpaidInvoices ?? []).map((inv) => (
                <li key={inv.invoiceNumber} className="flex justify-between">
                  <span>{inv.invoiceNumber}</span>
                  <span>{fmt(Number(inv.outstanding))}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
