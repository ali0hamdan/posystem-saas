import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import { forgotPassword, getApiErrorMessage } from '@/api/auth.api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const result = await forgotPassword(email.trim());
      setMessage(result.message);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Something went wrong. Please try again.'));
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
            <Mail className="h-7 w-7 text-primary-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forgot password</h1>
          </div>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Enter your account email and we will send a reset code.
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

            {message && (
              <p className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 text-sm text-blue-800 dark:text-blue-300">
                {message}
              </p>
            )}
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
              Send reset code
            </button>

            <p className="text-center text-sm text-gray-500">
              <Link to="/reset-password" className="text-primary-600 hover:underline">
                Already have a code?
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
