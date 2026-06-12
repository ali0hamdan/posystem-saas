import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { lookupSalesman, searchSalesmen } from '@/api/users.api';
import { useAuthStore } from '@/stores/auth-store';
import { useDebouncedValue } from '@/features/products/use-debounced-value';
import type { UserRole } from '@/types/auth';

const ASSIGN_ROLES: UserRole[] = ['OWNER', 'GENERAL_MANAGER', 'CO_MANAGER', 'ADMIN', 'MANAGER'];

type SalesmanAssignmentFieldProps = {
  salesmanIdCode: string;
  onSalesmanIdCodeChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
};

export function canAssignSalesman(role: UserRole | undefined): boolean {
  return role != null && ASSIGN_ROLES.includes(role);
}

export function SalesmanAssignmentField({
  salesmanIdCode,
  onSalesmanIdCodeChange,
  disabled,
  className,
}: SalesmanAssignmentFieldProps) {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const debouncedCode = useDebouncedValue(salesmanIdCode, 350);
  const [lookupError, setLookupError] = useState('');

  const searchQuery = useQuery({
    queryKey: ['users', 'salesmen-search', debouncedCode],
    queryFn: () => searchSalesmen(debouncedCode.length >= 2 ? debouncedCode : undefined),
    enabled: role === 'CASHIER' || canAssignSalesman(role),
  });

  const lookupQuery = useQuery({
    queryKey: ['users', 'salesmen-lookup', debouncedCode],
    queryFn: () => lookupSalesman(debouncedCode),
    enabled: (role === 'CASHIER' || canAssignSalesman(role)) && debouncedCode.trim().length >= 4,
    retry: false,
  });

  useEffect(() => {
    if (!debouncedCode.trim()) {
      setLookupError('');
      return;
    }
    if (lookupQuery.isError) {
      setLookupError('Salesman ID not found or inactive.');
      return;
    }
    if (lookupQuery.isSuccess) {
      setLookupError('');
    }
  }, [debouncedCode, lookupQuery.isError, lookupQuery.isSuccess]);

  const suggestions = useMemo(() => searchQuery.data ?? [], [searchQuery.data]);

  if (role === 'SALESMAN') {
    return (
      <div className={className}>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Salesman</p>
        <p className="mt-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink">
          {user?.name}
          {user?.salesmanIdCode ? (
            <span className="ml-2 font-mono text-xs text-ink-muted">({user.salesmanIdCode})</span>
          ) : null}
        </p>
      </div>
    );
  }

  if (role === 'CASHIER') {
    return (
      <div className={className}>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Salesman ID <span className="text-danger-600">*</span>
        </label>
        <input
          list="salesman-id-suggestions"
          className="h-11 w-full rounded-xl border border-line bg-canvas px-3 font-mono text-sm uppercase outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
          value={salesmanIdCode}
          onChange={(e) => onSalesmanIdCodeChange(e.target.value.toUpperCase())}
          placeholder="Enter salesman ID, e.g. ALIAHMAD-4821"
          disabled={disabled}
          required
        />
        <datalist id="salesman-id-suggestions">
          {suggestions.map((s) => (
            <option key={s.id} value={s.salesmanIdCode ?? ''}>
              {s.name}
            </option>
          ))}
        </datalist>
        {lookupQuery.isFetching ? (
          <p className="mt-1 text-xs text-ink-muted">Checking salesman ID…</p>
        ) : lookupQuery.data ? (
          <p className="mt-1 text-xs text-success-700">
            {lookupQuery.data.name} ({lookupQuery.data.salesmanIdCode})
          </p>
        ) : lookupError ? (
          <p className="mt-1 text-xs text-danger-700">{lookupError}</p>
        ) : (
          <p className="mt-1 text-xs text-ink-muted">Required for cashier sales and invoices.</p>
        )}
      </div>
    );
  }

  if (canAssignSalesman(role)) {
    return (
      <div className={className}>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Assign salesman (optional)
        </label>
        <select
          className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm"
          value={salesmanIdCode}
          onChange={(e) => onSalesmanIdCodeChange(e.target.value)}
          disabled={disabled || searchQuery.isLoading}
        >
          <option value="">No salesman</option>
          {suggestions.map((s) => (
            <option key={s.id} value={s.salesmanIdCode ?? ''}>
              {s.name} ({s.salesmanIdCode})
            </option>
          ))}
        </select>
      </div>
    );
  }

  return null;
}

/** @deprecated Use SalesmanAssignmentField */
export function SalesmanSelector({
  value,
  onChange,
  className,
  disabled,
}: {
  value: string;
  onChange: (salesmanId: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <SalesmanAssignmentField
      salesmanIdCode={value}
      onSalesmanIdCodeChange={onChange}
      className={className}
      disabled={disabled}
    />
  );
}
