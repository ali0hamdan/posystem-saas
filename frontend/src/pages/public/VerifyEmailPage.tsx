import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import {
  verifyEmailOtp,
  resendEmailOtp,
  getPublicApiError,
} from '@/api/public.api';

const RESEND_COOLDOWN = 60;

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const emailFromQuery = params.get('email') ?? '';

  const [email, setEmail] = useState(emailFromQuery);
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (emailFromQuery) setEmail(emailFromQuery);
  }, [emailFromQuery]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || otp.length !== 6) {
      setError('Enter your email and the 6-digit code.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await verifyEmailOtp({ email: email.trim(), otp });
      if (result.paymentId) {
        const qs = new URLSearchParams({
          paymentId: result.paymentId,
          plan: result.planCode ?? '',
          email: email.trim(),
          businessType: result.businessType,
        });
        navigate(`/payment?${qs.toString()}`);
      } else {
        navigate('/pricing');
      }
    } catch (err) {
      setError(getPublicApiError(err, 'Verification failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || !email.trim()) return;
    setError(null);
    setResending(true);
    try {
      await resendEmailOtp({ email: email.trim() });
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(getPublicApiError(err, 'Could not resend code. Please try again.'));
    } finally {
      setResending(false);
    }
  }

  const inp =
    'w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-xl p-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="h-7 w-7 text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verify your email</h1>
          </div>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            We sent a 6-digit verification code to your email.
          </p>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                className={inp}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className={`${inp} text-center text-lg tracking-[0.4em] font-mono`}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                required
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Verify email
            </button>

            <div className="flex flex-col items-center gap-2 text-sm">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
              >
                {resending
                  ? 'Sending…'
                  : cooldown > 0
                    ? `Resend code in ${cooldown}s`
                    : 'Resend code'}
              </button>
              <Link to="/get-started" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to registration
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
