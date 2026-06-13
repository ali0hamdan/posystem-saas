import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Copy, Check, Download, LogIn, Monitor } from 'lucide-react';
import { defaultDashboardPath } from '@/lib/business-routing';
import type { BusinessType } from '@/types/tenant-context';

export function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const activationCode = params.get('activationCode') ?? '';
  const plan = params.get('plan') ?? '';
  const email = params.get('email') ?? '';
  const businessType = (params.get('businessType') ?? 'RETAIL') as BusinessType;
  const isLifetime = params.get('lifetime') === '1';
  const desktopEnabled = params.get('desktop') === '1';
  const amount = params.get('amount');
  const nextDashboard =
    params.get('next') ?? defaultDashboardPath(businessType);
  const [copied, setCopied] = useState(false);
  const isDesktopLifetime = isLifetime && desktopEnabled;

  const BUSINESS_TYPE_LABEL: Record<string, string> = {
    RETAIL: 'Retail',
    FOOD_BEVERAGE: 'F&B',
    WHOLESALE: 'Wholesale',
    HYBRID: 'Hybrid',
  };
  const businessTypeLabel = BUSINESS_TYPE_LABEL[businessType] ?? businessType;

  function copyCode() {
    if (!activationCode) return;
    navigator.clipboard.writeText(activationCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-xl p-8 border border-gray-100 dark:border-gray-700 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isDesktopLifetime ? 'Your desktop license is ready' : 'Payment Successful!'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {isDesktopLifetime ? (
              <>
                You purchased the Desktop Lifetime license for{' '}
                <strong className="text-gray-700 dark:text-gray-200">{businessTypeLabel}</strong>.
                You can now download the desktop app and activate your system.
              </>
            ) : (
              <>Your <strong className="text-gray-700 dark:text-gray-200">{plan}</strong> subscription is now active.</>
            )}
          </p>

          {isDesktopLifetime && (
            <div className="mb-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-700 px-4 py-3 text-sm text-left">
              <p className="flex items-center gap-2 text-ink font-medium mb-2">
                <Monitor className="h-4 w-4" />
                One-time desktop license
              </p>
              <dl className="space-y-1 text-ink-muted">
                <div className="flex justify-between gap-4">
                  <dt>Plan</dt>
                  <dd className="font-medium">{plan}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Business type</dt>
                  <dd className="font-medium">{businessTypeLabel}</dd>
                </div>
                {amount && (
                  <div className="flex justify-between gap-4">
                    <dt>Price paid</dt>
                    <dd className="font-medium">${amount}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt>Billing type</dt>
                  <dd className="font-medium">One-time payment</dd>
                </div>
              </dl>
              <p className="text-xs text-ink-faint mt-2">
                Unlimited desktop use — download and activate your POS desktop app.
              </p>
            </div>
          )}

          {email && (
            <div className="mb-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-left">
              <p className="text-blue-700 dark:text-blue-300 font-medium mb-1">Your business account is ready</p>
              <p className="text-blue-600 dark:text-blue-400">
                Login email: <span className="font-mono font-bold">{email}</span>
              </p>
              <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                Use the password you set during registration.
              </p>
            </div>
          )}

          {activationCode && (
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Your Activation Code
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-3">
                <span className="flex-1 font-mono text-sm text-gray-900 dark:text-white break-all text-left">
                  {activationCode}
                </span>
                <button
                  onClick={copyCode}
                  title="Copy code"
                  className="shrink-0 rounded-lg p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400 text-left">
                Save this code. You'll need it to activate your POS device. It expires in 90 days.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {isDesktopLifetime && (
              <Link
                to="/download"
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900 py-3 text-sm font-semibold text-white transition-colors"
              >
                <Download className="h-4 w-4" />
                Download Desktop App
              </Link>
            )}
            <Link
              to="/login"
              state={{ paymentSuccess: true, email, from: nextDashboard }}
              className={`flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-semibold transition-colors ${
                isDesktopLifetime
                  ? 'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <LogIn className="h-4 w-4" />
              Go to Dashboard
            </Link>
            <Link
              to="/activate"
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-gray-200 dark:border-gray-600 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Activate your device
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
