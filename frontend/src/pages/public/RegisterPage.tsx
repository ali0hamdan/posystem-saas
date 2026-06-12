import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, ArrowLeft, BarChart3 } from 'lucide-react';
import {
  fetchPublicPlans,
  registerClient,
  getPublicApiError,
  type PublicPlan,
} from '@/api/public.api';
import { PasswordInput } from '@/components/ui/password-input';

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
  LIFETIME: 'One-time',
};

const PAGE_IN = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

export function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const planCode = params.get('plan') ?? '';
  const billingCycle = (params.get('cycle') ?? 'MONTHLY') as 'MONTHLY' | 'YEARLY' | 'LIFETIME';

  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    password: '',
    phone: '',
  });

  useEffect(() => {
    if (!planCode) {
      navigate('/pricing');
      return;
    }
    fetchPublicPlans()
      .then((plans) => {
        const found = plans.find((p) => p.code === planCode);
        if (!found) navigate('/pricing');
        else setPlan(found);
      })
      .catch(() => navigate('/pricing'))
      .finally(() => setLoadingPlan(false));
  }, [planCode, navigate]);

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await registerClient({
        businessName: form.businessName,
        ownerName: form.ownerName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        planCode,
        billingCycle,
      });
      navigate(`/verify-email?email=${encodeURIComponent(result.email)}`);
    } catch (err) {
      setError(getPublicApiError(err, 'Registration failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  let price = '';
  if (plan) {
    if (billingCycle === 'MONTHLY' && plan.monthlyPrice) price = `$${plan.monthlyPrice}/mo`;
    else if (billingCycle === 'YEARLY' && plan.yearlyPrice) price = `$${plan.yearlyPrice}/yr`;
    else if (billingCycle === 'LIFETIME' && plan.oneTimePrice) price = `$${plan.oneTimePrice} one-time`;
  }

  if (loadingPlan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <motion.div
      {...PAGE_IN}
      className="min-h-screen bg-canvas flex flex-col items-center justify-center py-12 px-4"
    >
      <div className="w-full max-w-md">
        <button onClick={() => navigate('/')} className="mb-6 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
            <BarChart3 className="h-4 w-4" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-ink">Nezhin POS</span>
        </button>

        <button
          onClick={() => navigate('/pricing')}
          className="mb-6 flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to pricing
        </button>

        <div className="rounded-2xl bg-surface shadow-xl p-8 border border-line">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Create your account</h1>
            {plan && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs px-3 py-1 font-medium">
                  {plan.name}
                </span>
                <span className="text-sm text-ink-muted">
                  {price} · {CYCLE_LABELS[billingCycle]}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Business name *</label>
              <input
                required minLength={2} maxLength={200}
                value={form.businessName} onChange={field('businessName')} placeholder="Acme Store"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder-ink-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Your full name *</label>
              <input
                required minLength={2} maxLength={200}
                value={form.ownerName} onChange={field('ownerName')} placeholder="John Smith"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder-ink-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Email *</label>
              <input
                required type="email" maxLength={200}
                value={form.email} onChange={field('email')} placeholder="john@acme.com"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder-ink-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Password *</label>
              <PasswordInput
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={form.password}
                onChange={field('password')}
                placeholder="At least 8 characters"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder-ink-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                Phone <span className="text-ink-faint font-normal">(optional)</span>
              </label>
              <input
                type="tel" maxLength={30}
                value={form.phone} onChange={field('phone')} placeholder="+1 555 000 0000"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder-ink-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
              />
            </div>

            <button
              type="submit" disabled={submitting}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Creating account…' : 'Continue to payment'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-ink-faint">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="text-primary-600 hover:underline font-medium">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
