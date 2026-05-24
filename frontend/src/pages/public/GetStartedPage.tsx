import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, Loader2, Check, Users, GitBranch,
  Monitor, Zap, BarChart3, Package, Home, ChevronRight,
} from 'lucide-react';
import {
  registerClient, fetchPublicPlans, getPublicApiError, type PublicPlan,
} from '@/api/public.api';

const ease = [0.22, 1, 0.36, 1] as const;

interface BusinessForm {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  phone: string;
}

type Cycle = 'MONTHLY' | 'YEARLY';

const LEFT_PERKS = [
  { icon: Zap,      label: 'Set up in minutes',   desc: 'No technical knowledge required.' },
  { icon: Package,  label: 'All features included', desc: 'Full POS & inventory on every plan.' },
  { icon: BarChart3,label: 'Real-time analytics',   desc: 'Know your numbers at any time.' },
];

const PLAN_BENEFITS = [
  'No credit card required to start',
  '14-day free trial on all plans',
  'Instant access after registration',
  'Cancel or upgrade anytime',
];

function LeftPanel({ step, anim }: { step: 1 | 2; anim: boolean }) {
  return (
    <motion.div
      className="relative hidden flex-col overflow-hidden bg-[#090e1a] lg:flex lg:w-[420px] xl:w-[480px]"
      initial={anim ? { x: '-100%' } : false}
      animate={{ x: 0 }}
      transition={{ duration: 0.75, ease }}>

      <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary-500/10 blur-3xl" />

      <div className="relative flex flex-1 flex-col justify-between px-10 py-12">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-bold text-white shadow-lg group-hover:scale-105 transition-transform">
            POS
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Stock POS</p>
            <p className="text-[11px] text-white/40">Inventory & Point of Sale</p>
          </div>
        </Link>

        {/* Step copy */}
        <div>
          {/* Step dots */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${s === step ? 'w-8 bg-primary-400' : s < step ? 'w-4 bg-primary-600/60' : 'w-4 bg-white/10'}`} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div key="left-s1"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease }}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-primary-400">Step 1 of 2</p>
                <h1 className="text-3xl font-bold leading-tight text-white xl:text-4xl">
                  Create your<br />
                  <span className="bg-gradient-to-r from-primary-400 to-primary-300 bg-clip-text text-transparent">business account</span>
                </h1>
                <p className="mt-4 text-[15px] leading-relaxed text-white/50">
                  Fill in your details and we'll have your store ready in minutes.
                </p>
                <ul className="mt-8 space-y-4">
                  {LEFT_PERKS.map(({ icon: Icon, label, desc }) => (
                    <li key={label} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                        <Icon className="h-4 w-4 text-primary-400" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-white/90">{label}</p>
                        <p className="text-[12px] text-white/40">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ) : (
              <motion.div key="left-s2"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease }}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-primary-400">Step 2 of 2</p>
                <h1 className="text-3xl font-bold leading-tight text-white xl:text-4xl">
                  Choose your<br />
                  <span className="bg-gradient-to-r from-primary-400 to-primary-300 bg-clip-text text-transparent">plan</span>
                </h1>
                <p className="mt-4 text-[15px] leading-relaxed text-white/50">
                  Pick the plan that fits your business. No hidden fees.
                </p>
                <ul className="mt-8 space-y-3">
                  {PLAN_BENEFITS.map(b => (
                    <li key={b} className="flex items-center gap-3 text-white/60 text-sm">
                      <Check className="h-4 w-4 text-primary-400 shrink-0" />{b}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-[11px] text-white/20">© {new Date().getFullYear()} Stock POS. All rights reserved.</p>
      </div>
    </motion.div>
  );
}

export function GetStartedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const anim = Boolean((location.state as { fromLanding?: boolean } | null)?.fromLanding);
  const [step, setStep] = useState<1 | 2>(1);
  const [leaving, setLeaving] = useState(false);

  function handleLoginRedirect() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => navigate('/login', { state: { fromLanding: true } }), 550);
  }

  // Step 1
  const [form, setForm] = useState<BusinessForm>({ businessName: '', ownerName: '', email: '', password: '', phone: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof BusinessForm, string>>>({});
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Step 2
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  const [submitting, setSubmitting] = useState<string | null>(null);

  const [apiError, setApiError] = useState<string | null>(null);

  function field(key: keyof BusinessForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(f => ({ ...f, [key]: e.target.value }));
      if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: undefined }));
    };
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<keyof BusinessForm, string>> = {};
    if (!form.businessName.trim()) errs.businessName = 'Required';
    if (!form.ownerName.trim()) errs.ownerName = 'Required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email';
    if (form.password.length < 8) errs.password = 'At least 8 characters';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setFieldErrors({});
    setApiError(null);
    setLoadingPlans(true);
    try {
      const all = await fetchPublicPlans();
      setPlans(all);
      setStep(2);
    } catch {
      setApiError('Could not load plans. Please try again.');
    } finally {
      setLoadingPlans(false);
    }
  }

  async function handleSelectPlan(plan: PublicPlan) {
    if (submitting) return;
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
      });
      navigate(`/payment?paymentId=${result.paymentId}&plan=${result.planCode}&username=${encodeURIComponent(result.username)}`);
    } catch (err) {
      setApiError(getPublicApiError(err, 'Registration failed. Please try again.'));
      setSubmitting(null);
    }
  }

  const inp = (key: keyof BusinessForm) =>
    `w-full rounded-xl border px-3.5 py-2.5 text-sm text-ink bg-surface placeholder-ink-faint transition focus:outline-none focus:ring-2 focus:ring-primary-500/25 ${
      fieldErrors[key] ? 'border-danger-500 focus:ring-danger-500/20' : 'border-line focus:border-primary-500'
    }`;

  const subscriptionPlans = plans.filter(p => p.type === 'SUBSCRIPTION');

  return (
    <>
      {/* Indigo overlay — slides out left, continuing the landing curtain */}
      {anim && (
        <motion.div
          className="fixed inset-0 z-[9999] pointer-events-none"
          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' }}
          initial={{ x: 0 }}
          animate={{ x: '-100%' }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.76, 0, 0.24, 1] }}
        />
      )}

      {/* Curtain overlay for navigating away from this page */}
      <AnimatePresence>
        {leaving && (
          <motion.div
            key="curtain"
            className="fixed inset-0 z-[9999]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' }}
          />
        )}
      </AnimatePresence>

      <div className="flex min-h-screen overflow-hidden">
      <LeftPanel step={step} anim={anim} />

      {/* ── Right panel ── */}
      <motion.div
        className="relative flex flex-1 flex-col bg-canvas overflow-hidden"
        initial={anim ? { x: '8%', opacity: 0 } : false}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.1, ease }}>
        <AnimatePresence mode="wait">

          {/* ── Step 1: Business info ── */}
          {step === 1 && (
            <motion.div key="s1"
              className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12"
              initial={{ x: '6%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-6%', opacity: 0 }}
              transition={{ duration: 0.38, ease }}>

              {/* Mobile brand */}
              <div className="mb-6 flex items-center gap-3 lg:hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-xs font-bold text-white">POS</div>
                <p className="text-sm font-semibold text-ink">Stock POS</p>
              </div>

              <div className="w-full max-w-sm">
                <div className="mb-7">
                  <h2 className="text-2xl font-bold text-ink tracking-tight">Your business details</h2>
                  <p className="mt-1.5 text-sm text-ink-muted">Tell us about your store to get started.</p>
                </div>

                {apiError && (
                  <div className="mb-5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300">
                    {apiError}
                  </div>
                )}

                <form onSubmit={handleContinue} className="space-y-4">
                  {([
                    { key: 'businessName', label: 'Business name', placeholder: 'Acme Store', type: 'text', required: true },
                    { key: 'ownerName',    label: 'Your full name', placeholder: 'John Smith',  type: 'text', required: true },
                    { key: 'email',        label: 'Email address',  placeholder: 'john@acme.com', type: 'email', required: true },
                    { key: 'password',     label: 'Password',        placeholder: 'At least 8 characters', type: 'password', required: true },
                    { key: 'phone',        label: 'Phone',           placeholder: '+1 555 000 0000', type: 'tel', required: false },
                  ] as const).map(({ key, label, placeholder, type, required }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-ink-muted mb-1.5">
                        {label} {!required && <span className="text-ink-faint font-normal">(optional)</span>}
                      </label>
                      <input
                        type={type}
                        required={required}
                        value={form[key]}
                        onChange={field(key)}
                        placeholder={placeholder}
                        className={inp(key)}
                      />
                      {fieldErrors[key] && <p className="mt-1 text-xs text-danger-500">{fieldErrors[key]}</p>}
                    </div>
                  ))}

                  <button type="submit" disabled={loadingPlans}
                    className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 py-3 text-sm font-bold text-white transition-colors">
                    {loadingPlans
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <><span>Continue to plans</span><ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>

                <div className="mt-5 flex flex-col items-center gap-2 text-xs text-ink-faint">
                  <p>Already have an account?{' '}
                    <button onClick={handleLoginRedirect} className="text-primary-600 hover:underline font-medium">Login</button>
                  </p>
                  <Link to="/" className="flex items-center gap-1 hover:text-ink-muted transition-colors">
                    <Home className="h-3 w-3" /> Back to home
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Plan selection ── */}
          {step === 2 && (
            <motion.div key="s2"
              className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10"
              initial={{ x: '6%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-6%', opacity: 0 }}
              transition={{ duration: 0.38, ease }}>

              <div className="w-full max-w-2xl">
                {/* Header row */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-ink tracking-tight">Pick your plan</h2>
                    <p className="mt-1 text-sm text-ink-muted">Start free, upgrade anytime. No contracts.</p>
                  </div>
                  {/* Billing cycle toggle */}
                  <div className="inline-flex shrink-0 rounded-xl border border-line bg-surface p-1 gap-1">
                    {(['MONTHLY', 'YEARLY'] as const).map(c => (
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

                {/* Plan cards */}
                <div className="grid gap-4 sm:grid-cols-3">
                  {subscriptionPlans.map((plan, i) => {
                    const isPopular = plan.code === 'BUSINESS';
                    const price = cycle === 'MONTHLY' ? plan.monthlyPrice : plan.yearlyPrice;
                    const isLoading = submitting === plan.code;
                    return (
                      <motion.div key={plan.id}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.07, ease }}
                        className={`relative flex flex-col rounded-2xl border-2 p-5 transition-shadow ${
                          isPopular
                            ? 'border-primary-500 shadow-lg shadow-primary-500/15'
                            : 'border-line hover:border-primary-300 hover:shadow-md'
                        } bg-surface`}>
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
                          <li className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-primary-400 shrink-0" />
                            Up to {plan.maxUsers} users
                          </li>
                          <li className="flex items-center gap-2">
                            <GitBranch className="h-3.5 w-3.5 text-primary-400 shrink-0" />
                            {plan.maxBranches} {plan.maxBranches === 1 ? 'branch' : 'branches'}
                          </li>
                          <li className="flex items-center gap-2">
                            <Monitor className="h-3.5 w-3.5 text-primary-400 shrink-0" />
                            {plan.maxDevices} devices
                          </li>
                        </ul>

                        <button
                          onClick={() => handleSelectPlan(plan)}
                          disabled={!!submitting || !price}
                          className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all disabled:opacity-50 ${
                            isPopular
                              ? 'bg-primary-600 hover:bg-primary-700 text-white'
                              : 'bg-canvas-raised border border-line hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 text-ink'
                          }`}>
                          {isLoading
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <><span>Choose plan</span><ChevronRight className="h-4 w-4" /></>}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Bottom nav */}
                <div className="mt-6 pt-5 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3">
                  <button
                    onClick={() => { setStep(1); setApiError(null); }}
                    className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors group">
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                    Edit my details
                  </button>
                  <Link to="/"
                    className="flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink transition-colors group">
                    <Home className="h-4 w-4" />
                    Back to home page
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
      </div>
    </>
  );
}
