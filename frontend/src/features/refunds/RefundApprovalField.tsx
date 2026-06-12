import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { lookupApprovalId } from '@/api/users.api';
import { useDebouncedValue } from '@/features/products/use-debounced-value';
import { formatRoleLabel } from '@/lib/format-user';

type RefundApprovalFieldProps = {
  approvalIdCode: string;
  onApprovalIdCodeChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
};

export function RefundApprovalField({
  approvalIdCode,
  onApprovalIdCodeChange,
  disabled,
  className,
}: RefundApprovalFieldProps) {
  const debouncedCode = useDebouncedValue(approvalIdCode, 350);
  const [lookupError, setLookupError] = useState('');

  const lookupQuery = useQuery({
    queryKey: ['users', 'approval-lookup', debouncedCode],
    queryFn: () => lookupApprovalId(debouncedCode),
    enabled: debouncedCode.trim().length >= 6,
    retry: false,
  });

  useEffect(() => {
    if (!debouncedCode.trim()) {
      setLookupError('');
      return;
    }
    if (lookupQuery.isError) {
      setLookupError('Invalid manager approval ID.');
      return;
    }
    if (lookupQuery.isSuccess) {
      setLookupError('');
    }
  }, [debouncedCode, lookupQuery.isError, lookupQuery.isSuccess]);

  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Manager / Co-Manager Approval ID <span className="text-danger-600">*</span>
      </label>
      <input
        className="h-11 w-full rounded-xl border border-line bg-canvas px-3 font-mono text-sm uppercase outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
        value={approvalIdCode}
        onChange={(e) => onApprovalIdCodeChange(e.target.value.toUpperCase())}
        placeholder="Enter approval ID, e.g. ALIAHMAD@48291"
        disabled={disabled}
        required
      />
      {lookupQuery.isFetching ? (
        <p className="mt-1 text-xs text-ink-muted">Checking approval ID…</p>
      ) : lookupQuery.data ? (
        <p className="mt-1 text-xs text-success-700">
          Approved by: {lookupQuery.data.name} — {formatRoleLabel(lookupQuery.data.role)}
        </p>
      ) : lookupError ? (
        <p className="mt-1 text-xs text-danger-700">{lookupError}</p>
      ) : (
        <p className="mt-1 text-xs text-ink-muted">
          Ask your General Manager or Co-Manager to enter their approval ID to authorize this refund.
        </p>
      )}
    </div>
  );
}
