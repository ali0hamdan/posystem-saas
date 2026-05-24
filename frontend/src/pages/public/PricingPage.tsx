import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Monitor, Users, GitBranch, Zap } from 'lucide-react';
import { fetchPublicPlans, type PublicPlan } from '@/api/public.api';

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
  LIFETIME: 'One-time',
};

const POPULAR_CODE = 'BUSINESS';

function PlanCard({ plan, cycle, onSelect }: { plan: PublicPlan; cycle: 'MONTHLY' | 'YEARLY' | 'LIFETIME'; onSelect: () => void }) {
  const isPopular = plan.code === POPULAR_CODE;

  let price: string | null = null;
  let cycleBillingLabel = '';
  if (plan.type === 'ONE_TIME') {
    price = plan.oneTimePrice;
    cycleBillingLabel = 'one-time payment';
  } else if (cycle === 'MONTHLY') {
    price = plan.monthlyPrice;
    cycleBillingLabel = '/ month';
  } else if (cycle === 'YEARLY') {
    price = plan.yearlyPrice;
    cycleBillingLabel = '/ year';
  }

  const features = Object.entries(plan.features ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 p-6 transition-shadow ${
        isPopular
          ? 'border-primary-500 shadow-lg shadow-primary-100 dark:shadow-primary-900/20'
          : 'border-line'
      } bg-surface`}
    >
      {isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-500 px-4 py-1 text-xs font-semibold text-white">
          Most Popular
        </span>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-bold text-ink">{plan.name}</h3>
        {plan.description && (
          <p className="mt-1 text-sm text-ink-muted">{plan.description}</p>
        )}
      </div>

      <div className="mb-6">
        {price ? (
          <>
            <span className="text-4xl font-extrabold text-ink">
              ${price}
            </span>
            <span className="ml-2 text-sm text-ink-muted">{cycleBillingLabel}</span>
          </>
        ) : (
          <span className="text-sm text-ink-faint">Not available for this cycle</span>
        )}
      </div>

      <ul className="mb-6 flex-1 space-y-2 text-sm">
        <li className="flex items-center gap-2 text-ink-muted">
          <Users className="h-4 w-4 text-primary-500 shrink-0" />
          Up to {plan.maxUsers} users
        </li>
        <li className="flex items-center gap-2 text-ink-muted">
          <GitBranch className="h-4 w-4 text-primary-500 shrink-0" />
          Up to {plan.maxBranches} {plan.maxBranches === 1 ? 'branch' : 'branches'}
        </li>
        <li className="flex items-center gap-2 text-ink-muted">
          <Monitor className="h-4 w-4 text-primary-500 shrink-0" />
          Up to {plan.maxDevices} devices
        </li>
        {plan.allowsDesktopDownload && (
          <li className="flex items-center gap-2 text-ink-muted">
            <Zap className="h-4 w-4 text-success-500 shrink-0" />
            Desktop offline app
          </li>
        )}
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-ink-muted">
            <Check className="h-4 w-4 text-success-500 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        disabled={!price}
        className={`w-full rounded-xl py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          isPopular
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-canvas-raised text-ink hover:bg-line'
        }`}
      >
        Get Started
      </button>
    </div>
  );
}

export function PricingPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY' | 'LIFETIME'>('MONTHLY');

  useEffect(() => {
    fetchPublicPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  function handleSelect(plan: PublicPlan) {
    const billingCycle = plan.type === 'ONE_TIME' ? 'LIFETIME' : cycle;
    navigate(`/register?plan=${plan.code}&cycle=${billingCycle}`);
  }

  const subscriptionPlans = plans.filter((p) => p.type === 'SUBSCRIPTION');
  const lifetimePlans = plans.filter((p) => p.type === 'ONE_TIME');
  const displayedPlans = cycle === 'LIFETIME' ? lifetimePlans : subscriptionPlans;

  return (
    <div className="min-h-screen bg-canvas py-16 px-4">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-ink sm:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-lg text-ink-muted">
            Start for free, grow with your business. Cancel anytime.
          </p>

          {/* Cycle toggle */}
          <div className="mt-8 inline-flex items-center rounded-xl border border-line bg-surface p-1 gap-1">
            {(['MONTHLY', 'YEARLY'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                  cycle === c
                    ? 'bg-primary-600 text-white shadow'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {CYCLE_LABELS[c]}
                {c === 'YEARLY' && (
                  <span className="ml-1.5 rounded bg-success-100 text-success-700 text-xs px-1.5 py-0.5">
                    Save 20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plans grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : displayedPlans.length === 0 ? (
          <p className="text-center text-ink-muted">No plans available right now.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayedPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} cycle={cycle} onSelect={() => handleSelect(plan)} />
            ))}
          </div>
        )}

        {/* Lifetime option */}
        {lifetimePlans.length > 0 && cycle !== 'LIFETIME' && (
          <div className="mt-10 text-center">
            <p className="text-sm text-ink-muted">
              Looking for a one-time purchase?{' '}
              <button
                onClick={() => setCycle('LIFETIME')}
                className="text-primary-600 underline hover:text-primary-700 font-medium"
              >
                See Lifetime plans
              </button>
            </p>
          </div>
        )}

        {/* Footer note */}
        <p className="mt-12 text-center text-xs text-ink-faint">
          All plans include unlimited products and sales. Prices in USD. Taxes may apply.
        </p>
      </div>
    </div>
  );
}
