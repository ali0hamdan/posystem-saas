import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { validateApproval, type RefundApprovalMethod } from '@/api/approvals.api';
import { useDebouncedValue } from '@/features/products/use-debounced-value';
import { useStoreSettings } from '@/hooks/use-store-settings';
import { formatRoleLabel } from '@/lib/format-user';
import { getApiErrorMessage } from '@/api/client';
import { NfcScanInput } from '@/components/ui/NfcScanInput';
import { RefundApprovalField } from '@/features/refunds/RefundApprovalField';

type RefundApprovalSectionProps = {
  approvalIdCode: string;
  onApprovalIdCodeChange: (code: string) => void;
  nfcCardUid: string;
  onNfcCardUidChange: (uid: string) => void;
  approvalPin: string;
  onApprovalPinChange: (pin: string) => void;
  disabled?: boolean;
  className?: string;
};

export function RefundApprovalSection({
  approvalIdCode,
  onApprovalIdCodeChange,
  nfcCardUid,
  onNfcCardUidChange,
  approvalPin,
  onApprovalPinChange,
  disabled,
  className,
}: RefundApprovalSectionProps) {
  const { settings } = useStoreSettings();
  const method: RefundApprovalMethod = settings?.refundApprovalMethod ?? 'APPROVAL_ID';
  const debouncedNfc = useDebouncedValue(nfcCardUid, 300);
  const [approverName, setApproverName] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');

  const nfcValidateMutation = useMutation({
    mutationFn: (body: Parameters<typeof validateApproval>[0]) => validateApproval(body),
    onSuccess: (result) => {
      setApproverName(`${result.approver.name} — ${formatRoleLabel(result.approver.role)}`);
      setValidationError('');
    },
    onError: (err) => {
      setApproverName(null);
      setValidationError(getApiErrorMessage(err, 'Invalid approval.'));
    },
  });

  useEffect(() => {
    setApproverName(null);
    setValidationError('');
  }, [method]);

  useEffect(() => {
    if (method !== 'NFC_CARD' && method !== 'NFC_CARD_AND_PIN') return;
    if (debouncedNfc.trim().length < 4) {
      setApproverName(null);
      setValidationError('');
      return;
    }
    if (method === 'NFC_CARD_AND_PIN' && approvalPin.trim().length < 4) return;
    nfcValidateMutation.mutate({
      method,
      nfcCardUid: debouncedNfc.trim(),
      ...(method === 'NFC_CARD_AND_PIN' ? { approvalPin: approvalPin.trim() } : {}),
    });
  }, [method, debouncedNfc, approvalPin]);

  if (method === 'APPROVAL_ID') {
    return (
      <RefundApprovalField
        className={className}
        approvalIdCode={approvalIdCode}
        onApprovalIdCodeChange={onApprovalIdCodeChange}
        disabled={disabled}
      />
    );
  }

  return (
    <div className={className}>
      <p className="mb-2 text-sm text-ink">
        {method === 'NFC_CARD'
          ? 'Tap manager NFC card to approve'
          : 'Tap manager NFC card and enter approval PIN'}
      </p>
      <NfcScanInput
        label="Manager NFC card"
        value={nfcCardUid}
        onChange={onNfcCardUidChange}
        disabled={disabled}
        onScanComplete={(uid) => onNfcCardUidChange(uid)}
      />
      {method === 'NFC_CARD_AND_PIN' ? (
        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Approval PIN <span className="text-danger-600">*</span>
          </label>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            className="h-11 w-full max-w-xs rounded-xl border border-line bg-canvas px-3 font-mono text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
            value={approvalPin}
            onChange={(e) => onApprovalPinChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="4–6 digit PIN"
            disabled={disabled}
          />
        </div>
      ) : null}
      {nfcValidateMutation.isPending ? (
        <p className="mt-2 text-xs text-ink-muted">Validating…</p>
      ) : approverName ? (
        <p className="mt-2 text-xs text-success-700">Approved by: {approverName}</p>
      ) : validationError ? (
        <p className="mt-2 text-xs text-danger-700">{validationError}</p>
      ) : null}
    </div>
  );
}

export function buildRefundApprovalPayload(
  method: RefundApprovalMethod,
  values: { approvalIdCode: string; nfcCardUid: string; approvalPin: string },
): { approvalIdCode?: string; nfcCardUid?: string; approvalPin?: string } {
  if (method === 'APPROVAL_ID') {
    return { approvalIdCode: values.approvalIdCode.trim().toUpperCase() };
  }
  if (method === 'NFC_CARD') {
    return { nfcCardUid: values.nfcCardUid.trim().toUpperCase() };
  }
  return {
    nfcCardUid: values.nfcCardUid.trim().toUpperCase(),
    approvalPin: values.approvalPin.trim(),
  };
}

export function validateRefundApprovalInput(
  method: RefundApprovalMethod,
  values: { approvalIdCode: string; nfcCardUid: string; approvalPin: string },
): string | null {
  if (method === 'APPROVAL_ID') {
    return values.approvalIdCode.trim() ? null : 'Approval ID is required.';
  }
  if (method === 'NFC_CARD') {
    return values.nfcCardUid.trim().length >= 4 ? null : 'NFC card is required.';
  }
  if (!values.nfcCardUid.trim()) return 'NFC card is required.';
  if (!values.approvalPin.trim()) return 'Approval PIN is required.';
  return null;
}
