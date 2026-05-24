import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CreditCard, ShieldCheck, AlertCircle } from 'lucide-react';
import {
  fetchPaymentStatus,
  simulatePaymentSuccess,
  getPublicApiError,
  type PaymentStatus,
} from '@/api/public.api';

const IS_DEV = import.meta.env.DEV;

export function PaymentPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const paymentId = params.get('paymentId') ?? '';
  const usernameParam = params.get('username') ?? '';

  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      navigate('/pricing');
      return;
    }
    fetchPaymentStatus(paymentId)
      .then((p) => {
        setPayment(p);
        if (p.status === 'PAID') {
          navigate(`/payment-success?paymentId=${paymentId}&plan=${p.planCode}&username=${encodeURIComponent(usernameParam)}`);
        }
      })
      .catch(() => setError('Payment not found. Please check your registration email.'))
      .finally(() => setLoading(false));
  }, [paymentId, navigate, usernameParam]);

  async function handleSimulate() {
    setError(null);
    setSimulating(true);
    try {
      const result = await simulatePaymentSuccess(paymentId);
      navigate(
        `/payment-success?paymentId=${paymentId}&activationCode=${encodeURIComponent(result.activationCode)}&plan=${result.planCode}&username=${encodeURIComponent(result.username ?? usernameParam)}`,
      );
    } catch (err) {
      setError(getPublicApiError(err, 'Payment simulation failed.'));
    } finally {
      setSimulating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-xl p-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <CreditCard className="h-7 w-7 text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Complete Payment</h1>
          </div>

          {payment && (
            <div className="mb-6 rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Plan</span>
                <span className="font-medium text-gray-900 dark:text-white">{payment.planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Billing</span>
                <span className="font-medium text-gray-900 dark:text-white">{payment.billingCycle}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                <span className="text-gray-700 dark:text-gray-300 font-semibold">Total</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  ${payment.amount} {payment.currency}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {IS_DEV ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                <strong>Development mode</strong> — Payment gateway not connected. Use the simulate button below.
              </div>
              <button
                onClick={handleSimulate}
                disabled={simulating}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {simulating && <Loader2 className="h-4 w-4 animate-spin" />}
                {simulating ? 'Processing…' : 'Simulate Payment Success'}
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Payment gateway integration coming soon. Please contact support to complete your purchase.
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Your account is secured. Payment is processed safely.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
