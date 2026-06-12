import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, Loader2, Monitor, Users, GitBranch, Zap, Store,
  UtensilsCrossed, Warehouse, Layers,
} from 'lucide-react';
import { fetchPublicPlans, type PublicPlan } from '@/api/public.api';

const POPULAR_CODE = 'BUSINESS';

type PricingBusinessType = 'RETAIL' | 'FOOD_BEVERAGE' | 'WHOLESALE' | 'HYBRID';

const BUSINESS_TABS: { type: PricingBusinessType; label: string; icon: typeof Store }[] = [
  { type: 'RETAIL', label: 'Retail', icon: Store },
  { type: 'FOOD_BEVERAGE', label: 'Food & Beverage', icon: UtensilsCrossed },
  { type: 'WHOLESALE', label: 'Wholesale / B2B', icon: Warehouse },
  { type: 'HYBRID', label: 'Hybrid', icon: Layers },
];

function featureLabels(plan: PublicPlan): string[] {
  return Object.entries(plan.features ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
}

function PlanCard({ plan, cycle, onSelect }: { plan: PublicPlan; cycle: 'MONTHLY' | 'YEARLY'; onSelect: () => void }) {
  const isPopular = plan.code === POPULAR_CODE;

  const price = cycle === 'MONTHLY' ? plan.monthlyPrice : plan.yearlyPrice;
  const cycleBillingLabel = cycle === 'MONTHLY' ? '/ month' : '/ year';
  const features = featureLabels(plan);

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
          {plan.maxUsers == null ? 'Unlimited users' : `Up to ${plan.maxUsers} users`}
        </li>
        <li className="flex items-center gap-2 text-ink-muted">
          <GitBranch className="h-4 w-4 text-primary-500 shrink-0" />
          {plan.maxBranches == null
            ? 'Unlimited branches'
            : `Up to ${plan.maxBranches} ${plan.maxBranches === 1 ? 'branch' : 'branches'}`}
        </li>
        <li className="flex items-center gap-2 text-ink-muted">
          <Monitor className="h-4 w-4 text-primary-500 shrink-0" />
          {plan.maxDevices == null ? 'Unlimited devices' : `Up to ${plan.maxDevices} devices`}
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

/** One-time-payment Desktop Lifetime card for the selected business type. */
function DesktopLifetimeCard({ plan, onSelect }: { plan: PublicPlan; onSelect: () => void }) {
  const FEATURES = [
    'One-time payment',
    'Unlimited users',
    'Unlimited branches',
    'Unlimited devices',
    'Unlimited products/orders/invoices',
    'Desktop app download',
    'Activation license included',
    'No monthly subscription',
  ];

  return (
    <div className="relative flex flex-col rounded-2xl border-2 border-indigo-400 dark:border-indigo-600 bg-surface p-6 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20">
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-indigo-600 px-4 py-1 text-xs font-semibold text-white">
        One-time payment
      </span>

      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-indigo-500" />
          <h3 className="text-xl font-bold text-ink">Desktop Lifetime</h3>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Pay once, download the desktop app, and own your POS desktop license for this system type.
        </p>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-extrabold text-ink">${plan.oneTimePrice}</span>
        <span className="ml-2 text-sm text-ink-muted">one-time payment</span>
      </div>

      <ul className="mb-6 flex-1 space-y-2 text-sm">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2 text-ink-muted">
            <Check className="h-4 w-4 text-success-500 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <p className="mb-3 text-xs text-ink-faint">
        One-time desktop license — unlimited desktop use for the selected system type.
      </p>

      <button
        onClick={onSelect}
        className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
      >
        Buy Desktop App
      </button>
    </div>
  );
}

export function PricingPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [businessType, setBusinessType] = useState<PricingBusinessType>('RETAIL');

  useEffect(() => {
    fetchPublicPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  function handleSelectSubscription(plan: PublicPlan) {
    navigate(`/get-started?type=${businessType}&plan=${plan.code}&cycle=${cycle}`);
  }

  function handleSelectLifetime(plan: PublicPlan) {
    navigate(`/get-started?type=${businessType}&plan=${plan.code}`);
  }

  // Subscription plans are shared across business types (vertical modules are
  // feature-gated); Desktop Lifetime plans are business-type specific.
  const subscriptionPlans = plans.filter(
    (p) => p.type === 'SUBSCRIPTION' && (!p.businessType || p.businessType === businessType),
  );
  const lifetimePlan = plans.find(
    (p) => p.type === 'ONE_TIME' && p.businessType === businessType && p.oneTimePrice,
  );

  return (
    <div className="min-h-screen bg-canvas py-16 px-4">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-ink sm:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-lg text-ink-muted">
            Pick your business type, then choose a monthly, yearly, or one-time desktop plan.
          </p>

          {/* Business type tabs */}
          <div className="mt-8 inline-flex flex-wrap items-center justify-center rounded-xl border border-line bg-surface p-1 gap-1">
            {BUSINESS_TABS.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setBusinessType(type)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  businessType === type
                    ? 'bg-primary-600 text-white shadow'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Cycle toggle (subscriptions only) */}
          <div className="mt-4 inline-flex items-center rounded-xl border border-line bg-surface p-1 gap-1 ml-0 sm:ml-3">
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
                {c === 'MONTHLY' ? 'Monthly' : 'Yearly'}
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
        ) : subscriptionPlans.length === 0 && !lifetimePlan ? (
          <p className="text-center text-ink-muted">No plans available right now.</p>
        ) : (
          <div className={`grid gap-6 sm:grid-cols-2 ${lifetimePlan ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            {subscriptionPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                cycle={cycle}
                onSelect={() => handleSelectSubscription(plan)}
              />
            ))}
            {lifetimePlan && (
              <DesktopLifetimeCard plan={lifetimePlan} onSelect={() => handleSelectLifetime(lifetimePlan)} />
            )}
          </div>
        )}

        {/* Footer note */}
        <p className="mt-12 text-center text-xs text-ink-faint">
          Prices in USD. Taxes may apply. Desktop Lifetime includes lifetime software access
          within plan limits; it is not unlimited support.
        </p>
      </div>
    </div>
  );
}
