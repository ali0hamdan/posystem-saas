import { useEffect, useRef } from 'react';

type NfcScanInputProps = {
  value: string;
  onChange: (uid: string) => void;
  onScanComplete?: (uid: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  label?: string;
};

export function normalizeNfcUidInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-F0-9]/g, '');
}

export function NfcScanInput({
  value,
  onChange,
  onScanComplete,
  disabled,
  placeholder = 'Tap NFC card or scan UID…',
  autoFocus = true,
  className,
  label,
}: NfcScanInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRef.current?.focus();
    }
  }, [autoFocus, disabled]);

  function handleChange(nextRaw: string) {
    onChange(normalizeNfcUidInput(nextRaw));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const uid = normalizeNfcUidInput(value);
    if (uid.length >= 4) {
      onScanComplete?.(uid);
    }
  }

  return (
    <div className={className}>
      {label ? (
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </label>
      ) : null}
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        className="h-11 w-full rounded-xl border border-line bg-canvas px-3 font-mono text-sm uppercase outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          const uid = normalizeNfcUidInput(value);
          if (uid.length >= 4) onScanComplete?.(uid);
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
      <p className="mt-1 text-xs text-ink-muted">Tap card on reader or type UID, then press Enter.</p>
    </div>
  );
}
