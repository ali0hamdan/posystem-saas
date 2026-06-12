import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, KeyRound } from 'lucide-react';
import { resetPassword, getApiErrorMessage } from '@/api/auth.api';
import { PasswordInput } from '@/components/ui/password-input';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (otp.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword({
        email: email.trim(),
        otp,
        newPassword,
      });
      navigate('/login', { state: { message: 'Password updated. Sign in with your new password.' } });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not reset password. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  const inp =
    'w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-xl p-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <KeyRound className="h-7 w-7 text-primary-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reset password</h1>
          </div>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Enter the code from your email and choose a new password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Reset code</label>
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

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">New password</label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-gray-400">At least 8 characters with uppercase, lowercase, and a number.</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm password</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
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
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset password
            </button>

            <p className="text-center text-sm text-gray-500">
              <Link to="/forgot-password" className="text-primary-600 hover:underline">
                Request a new code
              </Link>
              {' · '}
              <Link to="/login" className="text-primary-600 hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
