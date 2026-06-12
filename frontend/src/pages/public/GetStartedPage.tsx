import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, Loader2, Check, Users, GitBranch,
  Monitor, Zap, BarChart3, Package, Home, ChevronRight,
  Store, UtensilsCrossed, Barcode, Soup, ChefHat, ClipboardList, Warehouse,
  FileText, FileSpreadsheet, FileCheck, CreditCard, Truck,
} from 'lucide-react';
import {
  registerClient, fetchPublicPlans, getPublicApiError, type PublicPlan, type OnboardingBusinessType,
} from '@/api/public.api';
import { AuthShell, useAuthTransition, type AuthTransition } from '@/components/auth/AuthShell';
import { PasswordInput } from '@/components/ui/password-input';

const ease = [0.22, 1, 0.36, 1] as const;

type OnboardingStep = 1 | 2 | 3;

interface BusinessForm {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
}

type Cycle = 'MONTHLY' | 'YEARLY';

const LEFT_PERKS = [
  { icon: Zap, label: 'Launch in minutes', desc: 'Choose your system, verify email, and open your dashboard.' },
  { icon: Package, label: 'All features included', desc: 'Full POS & inventory on every plan.' },
  { icon: BarChart3, label: 'Real-time analytics', desc: 'Know your numbers at any time.' },
];

const PLAN_BENEFITS = [
  'No credit card required to start',
  '14-day free trial on all plans',
  'Instant access after registration',
  'Cancel or upgrade anytime',
];

const BUSINESS_OPTIONS: {
  type: OnboardingBusinessType;
  title: string;
  description: string;
  features: { icon: typeof Store; label: string }[];
}[] = [
  {
    type: 'RETAIL',
    title: 'Retail Store',
    description: 'For supermarkets, clothing shops, electronics shops, pharmacies, and general retail.',
    features: [
      { icon: Barcode, label: 'Barcode sales' },
      { icon: Package, label: 'Product stock' },
      { icon: ClipboardList, label: 'Purchase orders' },
      { icon: BarChart3, label: 'Retail reports' },
    ],
  },
  {
    type: 'FOOD_BEVERAGE',
    title: 'Food & Beverage',
    description: 'For restaurants, cafes, bakeries, fast food, juice shops, and food trucks.',
    features: [
      { icon: Soup, label: 'Menu and modifiers' },
      { icon: ClipboardList, label: 'Tables and orders' },
      { icon: ChefHat, label: 'Kitchen display' },
      { icon: UtensilsCrossed, label: 'Ingredients and recipes' },
    ],
  },
  {
    type: 'WHOLESALE',
    title: 'Wholesale / B2B',
    description: 'For warehouses, distributors, suppliers, companies, and bulk selling.',
    features: [
      { icon: FileText, label: 'Quotations' },
      { icon: FileSpreadsheet, label: 'Proforma invoices' },
      { icon: FileCheck, label: 'Official invoices' },
      { icon: CreditCard, label: 'Customer credit' },
      { icon: BarChart3, label: 'Bulk pricing' },
      { icon: Truck, label: 'Delivery notes' },
      { icon: Warehouse, label: 'Stock reservation' },
    ],
  },
  {
    type: 'HYBRID',
    title: 'Hybrid',
    description: 'Retail, F&B, and Wholesale workflows in one account with shared inventory and users.',
    features: [
      { icon: Store, label: 'Retail POS' },
      { icon: UtensilsCrossed, label: 'F&B operations' },
      { icon: Warehouse, label: 'Wholesale documents' },
      { icon: Users, label: 'Shared users & customers' },
    ],
  },
];

function LeftContent({
  step, vContainer, vItem,
}: {
  step: OnboardingStep;
  vContainer: Variants;
  vItem: Variants;
}) {
  return (
    <motion.div variants={vContainer} initial="hidden" animate="enter" className="relative flex flex-1 flex-col justify-between px-10 py-12">
      <motion.div variants={vItem}>
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-bold text-white shadow-lg group-hover:scale-105 transition-transform">
            POS
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Nezhin POS</p>
            <p className="text-[11px] text-white/40">Inventory & Point of Sale</p>
          </div>
        </Link>
      </motion.div>

      <div>
        <div className="flex items-center gap-2 mb-8">
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                s === step ? 'w-8 bg-primary-400' : s < step ? 'w-4 bg-primary-600/60' : 'w-4 bg-white/10'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="left-s1" variants={vContainer} initial="hidden" animate="enter" exit="exit">
              <motion.p variants={vItem} className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-primary-400">Step 1 of 3</motion.p>
              <motion.h1 variants={vItem} className="text-3xl font-bold leading-tight text-white xl:text-4xl">
                Choose your<br />
                <span className="bg-gradient-to-r from-primary-400 to-primary-300 bg-clip-text text-transparent">business type</span>
              </motion.h1>
              <motion.p variants={vItem} className="mt-4 text-[15px] leading-relaxed text-white/50">
                We'll tailor your dashboard, navigation, and POS experience to match how you sell.
              </motion.p>
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="left-s2" variants={vContainer} initial="hidden" animate="enter" exit="exit">
              <motion.p variants={vItem} className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-primary-400">Step 2 of 3</motion.p>
              <motion.h1 variants={vItem} className="text-3xl font-bold leading-tight text-white xl:text-4xl">
                Create your<br />
                <span className="bg-gradient-to-r from-primary-400 to-primary-300 bg-clip-text text-transparent">business account</span>
              </motion.h1>
              <motion.p variants={vItem} className="mt-4 text-[15px] leading-relaxed text-white/50">
                Fill in your details and we'll have your store ready in minutes.
              </motion.p>
              <motion.ul variants={vContainer} className="mt-8 space-y-4">
                {LEFT_PERKS.map(({ icon: Icon, label, desc }) => (
                  <motion.li key={label} variants={vItem} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                      <Icon className="h-4 w-4 text-primary-400" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-white/90">{label}</p>
                      <p className="text-[12px] text-white/40">{desc}</p>
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="left-s3" variants={vContainer} initial="hidden" animate="enter" exit="exit">
              <motion.p variants={vItem} className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-primary-400">Step 3 of 3</motion.p>
              <motion.h1 variants={vItem} className="text-3xl font-bold leading-tight text-white xl:text-4xl">
                Choose your<br />
                <span className="bg-gradient-to-r from-primary-400 to-primary-300 bg-clip-text text-transparent">plan</span>
              </motion.h1>
              <motion.p variants={vItem} className="mt-4 text-[15px] leading-relaxed text-white/50">
                Pick the plan that fits your business. No hidden fees.
              </motion.p>
              <motion.ul variants={vContainer} className="mt-8 space-y-3">
                {PLAN_BENEFITS.map((b) => (
                  <motion.li key={b} variants={vItem} className="flex items-center gap-3 text-white/60 text-sm">
                    <Check className="h-4 w-4 text-primary-400 shrink-0" />{b}
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.p variants={vItem} className="text-[11px] text-white/20">© {new Date().getFullYear()} Nezhin POS. All rights reserved.</motion.p>
    </motion.div>
  );
}

export function GetStartedPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t: AuthTransition = useAuthTransition();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [businessType, setBusinessType] = useState<OnboardingBusinessType | null>(null);

  const [form, setForm] = useState<BusinessForm>({
    businessName: '', ownerName: '', email: '', password: '', confirmPassword: '', phone: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof BusinessForm, string>>>({});
  const [loadingPlans, setLoadingPlans] = useState(false);

  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Plan preselected from the pricing/landing page (e.g. RETAIL_DESKTOP_LIFETIME).
  const preselectedPlanCode = searchParams.get('plan')?.toUpperCase() ?? null;

  useEffect(() => {
    const raw = searchParams.get('type')?.toUpperCase();
    const valid: OnboardingBusinessType[] = ['RETAIL', 'FOOD_BEVERAGE', 'WHOLESALE', 'HYBRID'];
    if (raw && valid.includes(raw as OnboardingBusinessType)) {
      setBusinessType(raw as OnboardingBusinessType);
      setStep(2);
    }
    // Hybrid Desktop Lifetime is discontinued — surface a clear message.
    if (searchParams.get('plan')?.toUpperCase() === 'HYBRID_DESKTOP_LIFETIME') {
      setApiError('Hybrid Desktop Lifetime is not available.');
    }
  }, [searchParams]);

  function fieldHandler(key: keyof BusinessForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    };
  }

  function handleBusinessTypeSelect(type: OnboardingBusinessType) {
    setBusinessType(type);
    setApiError(null);
    setStep(2);
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<keyof BusinessForm, string>> = {};
    if (!form.businessName.trim()) errs.businessName = 'Required';
    if (!form.ownerName.trim()) errs.ownerName = 'Required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email';
    if (form.password.length < 8) errs.password = 'At least 8 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setFieldErrors({});
    setApiError(null);
    setLoadingPlans(true);
    try {
      const all = await fetchPublicPlans();
      setPlans(all);
      setStep(3);
    } catch {
      setApiError('Could not load plans. Please try again.');
    } finally {
      setLoadingPlans(false);
    }
  }

  async function handleSelectPlan(plan: PublicPlan) {
    if (submitting || !businessType) return;
    setApiError(null);
    setSubmitting(plan.code);
    const billingCycle = plan.type === 'ONE_TIME' ? 'LIFETIME' : cycle;
    try {
      const result = await registerClient({
        businessName: form.businessName,
        ownerName: form.ownerName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        planCode: plan.code,
        billingCycle,
        businessType,
      });
      navigate(`/verify-email?email=${encodeURIComponent(result.email)}`);
    } catch (err) {
      setApiError(getPublicApiError(err, 'Registration failed. Please try again.'));
      setSubmitting(null);
    }
  }

  const inp = (key: keyof BusinessForm) =>
    `w-full rounded-xl border px-3.5 py-2.5 text-sm text-ink bg-surface placeholder-ink-faint transition focus:outline-none focus:ring-2 focus:ring-primary-500/25 ${
      fieldErrors[key] ? 'border-danger-500 focus:ring-danger-500/20' : 'border-line focus:border-primary-500'
    }`;

  const subscriptionPlans = plans.filter(
    (p) => p.type === 'SUBSCRIPTION' && (!p.businessType || p.businessType === businessType),
  );
  // Business-type-specific one-time Desktop Lifetime package.
  const lifetimePlan = plans.find(
    (p) => p.type === 'ONE_TIME' && p.businessType === businessType && p.oneTimePrice,
  );
  const left = <LeftContent step={step} vContainer={t.vContainer} vItem={t.vItem} />;

  const right = (
    <AnimatePresence mode="wait">
      {step === 1 && (
        <motion.div
          key="s1"
          className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12"
          initial={{ x: '6%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-6%', opacity: 0 }}
          transition={{ duration: 0.38, ease }}
        >
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-xs font-bold text-white">POS</div>
            <p className="text-sm font-semibold text-ink">Nezhin POS</p>
          </div>

          <motion.div variants={t.vContainer} initial="hidden" animate="enter" className="w-full max-w-2xl">
            <motion.div variants={t.vItem} className="mb-7 text-center lg:text-left">
              <h2 className="text-2xl font-bold text-ink tracking-tight">What type of business do you run?</h2>
              <p className="mt-1.5 text-sm text-ink-muted">Choose the option that best describes your store. You can contact support to change this later.</p>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BUSINESS_OPTIONS.map((opt, i) => {
                const Icon = opt.type === 'RETAIL' ? Store : opt.type === 'FOOD_BEVERAGE' ? UtensilsCrossed : Warehouse;
                const selected = businessType === opt.type;
                return (
                  <motion.button
                    key={opt.type}
                    type="button"
                    variants={t.vItem}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={() => handleBusinessTypeSelect(opt.type)}
                    className={`relative flex flex-col rounded-2xl border-2 p-5 text-left transition-all hover:shadow-md ${
                      selected
                        ? 'border-primary-500 bg-primary-50/50 shadow-lg shadow-primary-500/10 dark:bg-primary-500/10'
                        : 'border-line bg-surface hover:border-primary-300'
                    }`}
                  >
                    {selected && (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${selected ? 'bg-primary-600 text-white' : 'bg-canvas-raised text-primary-600'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-bold text-ink">{opt.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">{opt.description}</p>
                    <ul className="mt-4 space-y-1.5">
                      {opt.features.map(({ icon: FIcon, label }) => (
                        <li key={label} className="flex items-center gap-2 text-xs text-ink-muted">
                          <FIcon className="h-3.5 w-3.5 shrink-0 text-primary-500" />
                          {label}
                        </li>
                      ))}
                    </ul>
                  </motion.button>
                );
              })}
            </div>

            <motion.div variants={t.vItem} className="mt-6 flex flex-col items-center gap-2 text-xs text-ink-faint">
              <p>Already have an account?{' '}
                <button onClick={() => t.goAuth('/login')} className="text-primary-600 hover:underline font-medium">Login</button>
              </p>
              <button onClick={t.goHome} className="flex items-center gap-1 hover:text-ink-muted transition-colors">
                <Home className="h-3 w-3" /> Back to home
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div
          key="s2"
          className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12"
          initial={{ x: '6%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-6%', opacity: 0 }}
          transition={{ duration: 0.38, ease }}
        >
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-xs font-bold text-white">POS</div>
            <p className="text-sm font-semibold text-ink">Nezhin POS</p>
          </div>

          <motion.div variants={t.vContainer} initial="hidden" animate="enter" className="w-full max-w-sm">
            <motion.div variants={t.vItem} className="mb-7">
              <h2 className="text-2xl font-bold text-ink tracking-tight">Your business details</h2>
              <p className="mt-1.5 text-sm text-ink-muted">
                {businessType === 'FOOD_BEVERAGE'
                  ? 'Tell us about your restaurant or cafe.'
                  : businessType === 'WHOLESALE'
                    ? 'Tell us about your wholesale or distribution business.'
                    : 'Tell us about your store.'}
              </p>
            </motion.div>

            {apiError && (
              <div className="mb-5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300">
                {apiError}
              </div>
            )}

            <motion.form variants={t.vContainer} onSubmit={handleContinue} className="space-y-4">
              {([
                { key: 'businessName', label: 'Business name', placeholder: businessType === 'FOOD_BEVERAGE' ? 'Bloom Cafe' : businessType === 'WHOLESALE' ? 'Vertex Distributors' : 'Acme Store', type: 'text', required: true },
                { key: 'ownerName', label: 'Your full name', placeholder: 'John Smith', type: 'text', required: true },
                { key: 'email', label: 'Email address', placeholder: 'john@acme.com', type: 'email', required: true },
                { key: 'password', label: 'Password', placeholder: 'At least 8 characters', type: 'password', required: true },
                { key: 'confirmPassword', label: 'Confirm password', placeholder: 'Repeat your password', type: 'password', required: true },
                { key: 'phone', label: 'Phone', placeholder: '+1 555 000 0000', type: 'tel', required: false },
              ] as const).map(({ key, label, placeholder, type, required }) => (
                <motion.div key={key} variants={t.vItem}>
                  <label className="block text-sm font-medium text-ink-muted mb-1.5">
                    {label} {!required && <span className="text-ink-faint font-normal">(optional)</span>}
                  </label>
                  {key === 'password' || key === 'confirmPassword' ? (
                    <PasswordInput
                      id={`get-started-${key}`}
                      required={required}
                      autoComplete={key === 'password' ? 'new-password' : 'off'}
                      value={form[key]}
                      onChange={fieldHandler(key)}
                      placeholder={placeholder}
                      className={inp(key)}
                    />
                  ) : (
                    <input type={type} required={required} value={form[key]} onChange={fieldHandler(key)} placeholder={placeholder} className={inp(key)} />
                  )}
                  {fieldErrors[key] && <p className="mt-1 text-xs text-danger-500">{fieldErrors[key]}</p>}
                </motion.div>
              ))}

              <motion.div variants={t.vItem}>
                <button type="submit" disabled={loadingPlans}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 py-3 text-sm font-bold text-white transition-colors">
                  {loadingPlans ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Continue to plans</span><ArrowRight className="h-4 w-4" /></>}
                </button>
              </motion.div>
            </motion.form>

            <motion.div variants={t.vItem} className="mt-5 flex flex-col items-center gap-2 text-xs text-ink-faint">
              <button onClick={() => { setStep(1); setApiError(null); }} className="flex items-center gap-1 hover:text-ink-muted transition-colors">
                <ArrowLeft className="h-3 w-3" /> Change business type
              </button>
              <p>Already have an account?{' '}
                <button onClick={() => t.goAuth('/login')} className="text-primary-600 hover:underline font-medium">Login</button>
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}

      {step === 3 && (
        <motion.div
          key="s3"
          className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10"
          initial={{ x: '6%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-6%', opacity: 0 }}
          transition={{ duration: 0.38, ease }}
        >
          <div className={`w-full ${lifetimePlan ? 'max-w-4xl' : 'max-w-2xl'}`}>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-ink tracking-tight">Pick your plan</h2>
                <p className="mt-1 text-sm text-ink-muted">Start free, upgrade anytime. No contracts.</p>
              </div>
              <div className="inline-flex shrink-0 rounded-xl border border-line bg-surface p-1 gap-1">
                {(['MONTHLY', 'YEARLY'] as const).map((c) => (
                  <button key={c} onClick={() => setCycle(c)}
                    className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${cycle === c ? 'bg-primary-600 text-white shadow' : 'text-ink-muted hover:text-ink'}`}>
                    {c === 'MONTHLY' ? 'Monthly' : 'Yearly'}
                    {c === 'YEARLY' && <span className="ml-1 text-[10px] text-success-500 font-bold">−20%</span>}
                  </button>
                ))}
              </div>
            </div>

            {apiError && (
              <div className="mb-4 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300">
                {apiError}
              </div>
            )}

            <div className={`grid gap-4 sm:grid-cols-2 ${lifetimePlan ? 'lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
              {subscriptionPlans.map((plan, i) => {
                const isPopular = plan.code === 'BUSINESS';
                const isPreselected = preselectedPlanCode === plan.code;
                const price = cycle === 'MONTHLY' ? plan.monthlyPrice : plan.yearlyPrice;
                const isLoading = submitting === plan.code;
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.07, ease }}
                    className={`relative flex flex-col rounded-2xl border-2 p-5 transition-shadow ${
                      isPopular || isPreselected ? 'border-primary-500 shadow-lg shadow-primary-500/15' : 'border-line hover:border-primary-300 hover:shadow-md'
                    } bg-surface`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-500 px-3 py-0.5 text-[11px] font-bold text-white whitespace-nowrap">
                        Most Popular
                      </span>
                    )}
                    <div className="mb-3">
                      <p className="font-bold text-base text-ink">{plan.name}</p>
                      {plan.description && <p className="text-xs text-ink-muted mt-0.5">{plan.description}</p>}
                    </div>
                    <div className="mb-4">
                      {price ? (
                        <>
                          <span className="text-3xl font-black text-ink">${price}</span>
                          <span className="text-sm text-ink-muted ml-1">{cycle === 'MONTHLY' ? '/mo' : '/yr'}</span>
                        </>
                      ) : (
                        <span className="text-sm text-ink-faint">Not available</span>
                      )}
                    </div>
                    <ul className="mb-5 flex-1 space-y-2 text-xs text-ink-muted">
                      <li className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-primary-400 shrink-0" />{plan.maxUsers == null ? 'Unlimited users' : `Up to ${plan.maxUsers} users`}</li>
                      <li className="flex items-center gap-2"><GitBranch className="h-3.5 w-3.5 text-primary-400 shrink-0" />{plan.maxBranches == null ? 'Unlimited branches' : `${plan.maxBranches} ${plan.maxBranches === 1 ? 'branch' : 'branches'}`}</li>
                      <li className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5 text-primary-400 shrink-0" />{plan.maxDevices == null ? 'Unlimited devices' : `${plan.maxDevices} devices`}</li>
                    </ul>
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={!!submitting || !price}
                      className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all disabled:opacity-50 ${
                        isPopular ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-canvas-raised border border-line hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 text-ink'
                      }`}
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Choose plan</span><ChevronRight className="h-4 w-4" /></>}
                    </button>
                  </motion.div>
                );
              })}

              {lifetimePlan && (
                <motion.div
                  key={lifetimePlan.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: subscriptionPlans.length * 0.07, ease }}
                  className={`relative flex flex-col rounded-2xl border-2 p-5 transition-shadow bg-surface ${
                    preselectedPlanCode === lifetimePlan.code
                      ? 'border-amber-500 shadow-lg shadow-amber-500/20'
                      : 'border-amber-400/70 hover:border-amber-500 hover:shadow-md'
                  }`}
                >
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-600 px-3 py-0.5 text-[11px] font-bold text-white whitespace-nowrap">
                    One-time payment
                  </span>
                  <div className="mb-3">
                    <p className="font-bold text-base text-ink flex items-center gap-1.5">
                      <Monitor className="h-4 w-4 text-amber-500" />
                      Desktop Lifetime
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Pay once, download the desktop app, and own your POS desktop license for this system type.
                    </p>
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-black text-ink">${lifetimePlan.oneTimePrice}</span>
                    <span className="text-sm text-ink-muted ml-1">once</span>
                  </div>
                  <ul className="mb-3 flex-1 space-y-2 text-xs text-ink-muted">
                    <li className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-amber-400 shrink-0" />Unlimited users</li>
                    <li className="flex items-center gap-2"><GitBranch className="h-3.5 w-3.5 text-amber-400 shrink-0" />Unlimited branches</li>
                    <li className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5 text-amber-400 shrink-0" />Unlimited devices</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success-500 shrink-0" />Desktop app download & activation license</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success-500 shrink-0" />No monthly subscription</li>
                  </ul>
                  <p className="mb-3 text-[11px] leading-relaxed text-ink-faint">
                    This is a one-time desktop license with unlimited local desktop use for the
                    selected system.
                  </p>
                  <button
                    onClick={() => handleSelectPlan(lifetimePlan)}
                    disabled={!!submitting}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all disabled:opacity-50 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {submitting === lifetimePlan.code ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Buy Desktop App</span><ChevronRight className="h-4 w-4" /></>}
                  </button>
                </motion.div>
              )}
            </div>

            <div className="mt-6 pt-5 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3">
              <button onClick={() => { setStep(2); setApiError(null); }}
                className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors group">
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                Edit my details
              </button>
              <button onClick={t.goHome} className="flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink transition-colors group">
                <Home className="h-4 w-4" />Back to home page
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return <AuthShell t={t} left={left} right={right} />;
}
