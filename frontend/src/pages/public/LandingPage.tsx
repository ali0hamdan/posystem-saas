import { useCallback, useContext, createContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Loader2,
  Menu,
  Moon,
  Sun,
  Users,
  GitBranch,
  Monitor,
  X,
} from 'lucide-react';
import { fetchPublicPlans, type PublicPlan } from '@/api/public.api';
import { useTheme } from '@/theme/use-theme';
import {
  BUSINESS_TYPE_CARDS,
  CORE_FEATURE_GROUPS,
  FAQ_ITEMS,
  FNB_FEATURES,
  HERO_BADGES,
  HERO_HIGHLIGHT,
  HERO_STATS,
  HERO_SUBHEADLINE,
  NAV_SECTIONS,
  NOTIFICATION_TYPES,
  ONBOARDING_STEPS,
  PRICING_TYPE_CONTEXT,
  RETAIL_FEATURES,
  ROLE_GROUPS,
  WHY_CHOOSE,
  WHOLESALE_FEATURES,
} from '@/pages/public/landing-content';

function useDark() {
  return useTheme().resolvedTheme === 'dark';
}

const EASE = [0.22, 1, 0.36, 1] as const;

const LandingNavContext = createContext<(path: string) => void>(() => {});
function useLandingNav() {
  return useContext(LandingNavContext);
}

function FadeIn({
  children,
  delay = 0,
  y = 18,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children, dark }: { children: React.ReactNode; dark: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${dark ? 'text-white/45' : 'text-ink-faint'}`}
    >
      <span className="h-1 w-1 rounded-full bg-primary-500" />
      {children}
    </span>
  );
}

function SectionShell({
  id,
  children,
  className = '',
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`relative z-10 py-20 sm:py-28 ${className}`}>
      <div className="mx-auto max-w-6xl px-6">{children}</div>
    </section>
  );
}

function FeatureList({ items, dark }: { items: string[]; dark: boolean }) {
  return (
    <ul className="mt-5 space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
          <span className={dark ? 'text-white/60' : 'text-ink-muted'}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Navbar() {
  const dark = useDark();
  const { toggleTheme } = useTheme();
  const go = useLandingNav();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const navBg = scrolled
    ? dark
      ? 'bg-canvas/85 backdrop-blur-xl border-b border-white/8'
      : 'bg-white/85 backdrop-blur-xl border-b border-line'
    : 'border-b border-transparent';

  return (
    <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${navBg}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
            <BarChart3 className="h-4 w-4" />
          </div>
          <span className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>
            Nezhin POS
          </span>
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {NAV_SECTIONS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className={`text-sm transition-colors ${dark ? 'text-white/55 hover:text-white' : 'text-ink-muted hover:text-ink'}`}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${dark ? 'text-white/55 hover:bg-white/8 hover:text-white' : 'text-ink-muted hover:bg-canvas-raised hover:text-ink'}`}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => go('/login')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${dark ? 'text-white/70 hover:text-white' : 'text-ink-muted hover:text-ink'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => go('/get-started')}
            className="group inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            Get Started
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`flex h-9 w-9 items-center justify-center rounded-full ${dark ? 'text-white/60' : 'text-ink-muted'}`}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={dark ? 'p-2 text-white/70' : 'p-2 text-ink-muted'}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`overflow-hidden border-t md:hidden ${dark ? 'border-white/8 bg-canvas/95 backdrop-blur-xl' : 'border-line bg-white/95 backdrop-blur-xl'}`}
          >
            <div className="flex flex-col gap-1 px-6 py-4">
              {NAV_SECTIONS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`py-2 text-sm ${dark ? 'text-white/65' : 'text-ink-muted'}`}
                >
                  {l.label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  go('/login');
                }}
                className={`py-2 text-left text-sm ${dark ? 'text-white/65' : 'text-ink-muted'}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  go('/get-started');
                }}
                className="mt-2 rounded-full bg-primary-600 px-4 py-2.5 text-center text-sm font-medium text-white"
              >
                Get Started
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}

function Hero() {
  const dark = useDark();
  const go = useLandingNav();

  return (
    <section className="relative overflow-hidden pt-28 sm:pt-36">
      {/* Single soft glow at the top — the only color accent in the hero.
          Light mode: a warm sunrise hint from the top; dark mode: a quieter
          ember. No orbs, no 3D, no blobs. Everything else is clean canvas. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-[44rem] ${
          dark
            ? 'bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(249,115,22,0.16),transparent_70%)]'
            : 'bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(249,115,22,0.10),transparent_70%)]'
        }`}
      />

      {/* Whisper-thin dot grid. Masked tightly around the headline so it
          reads as texture, not pattern. The only "creative" decoration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${
            dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.05)'
          } 1px, transparent 0)`,
          backgroundSize: '28px 28px',
          maskImage:
            'radial-gradient(ellipse 55% 45% at 50% 22%, black 50%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 55% 45% at 50% 22%, black 50%, transparent 100%)',
        }}
      />

      {/* Bottom blend. Fades into bg-canvas so the next section joins
          seamlessly. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-32 ${
          dark
            ? 'bg-[linear-gradient(180deg,transparent_0%,var(--color-canvas,#0f0f11)_100%)]'
            : 'bg-[linear-gradient(180deg,transparent_0%,var(--color-canvas,#fffaf5)_100%)]'
        }`}
      />

      <div className="relative mx-auto max-w-6xl px-6 pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            <span
              className={`inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wide ${dark ? 'border-primary-400/30 bg-primary-500/10 text-primary-200' : 'border-primary-200 bg-primary-50 text-primary-700'}`}
            >
              {HERO_HIGHLIGHT}
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease: EASE }}
            className={`mt-6 text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-5xl lg:text-[3.25rem] ${dark ? 'text-white' : 'text-ink'}`}
          >
            Sell. Track. Grow.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.16, ease: EASE }}
            className={`mx-auto mt-6 max-w-2xl text-lg leading-relaxed ${dark ? 'text-white/55' : 'text-ink-muted'}`}
          >
            <span className={`font-medium ${dark ? 'text-white/75' : 'text-ink'}`}>{HERO_HIGHLIGHT}. </span>
            {HERO_SUBHEADLINE}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.24, ease: EASE }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <button
              type="button"
              onClick={() => go('/get-started')}
              className="group inline-flex items-center gap-2 rounded-full bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <a
              href="#pricing"
              className={`inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors ${dark ? 'border-white/15 text-white hover:bg-white/5' : 'border-line text-ink hover:bg-white/60'}`}
            >
              View Packages
            </a>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.32 }}
            className="mt-8 flex flex-wrap justify-center gap-2"
          >
            {HERO_BADGES.map((badge) => (
              <span
                key={badge}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${dark ? 'border-white/10 bg-white/[0.04] text-white/65' : 'border-line bg-white/70 text-ink-muted'}`}
              >
                {badge}
              </span>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: EASE }}
          className="mx-auto mt-14 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          {HERO_STATS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className={`rounded-2xl border p-4 text-center backdrop-blur-sm ${dark ? 'border-white/10 bg-white/[0.04]' : 'border-line bg-white/75'}`}
            >
              <Icon className={`mx-auto h-5 w-5 ${dark ? 'text-primary-300' : 'text-primary-600'}`} />
              <p className={`mt-2 text-xs font-medium leading-snug ${dark ? 'text-white/60' : 'text-ink-muted'}`}>
                {label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function OnboardingSteps() {
  const dark = useDark();

  return (
    <SectionShell id="how-it-works" className={dark ? '' : 'bg-canvas-raised/40'}>
      <FadeIn className="mx-auto max-w-2xl text-center">
        <Eyebrow dark={dark}>Getting started</Eyebrow>
        <h2 className={`mt-5 text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>
          Launch in 4 simple steps
        </h2>
      </FadeIn>
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ONBOARDING_STEPS.map((step, i) => (
          <FadeIn key={step.title} delay={i * 0.05}>
            <div
              className={`relative h-full rounded-2xl border p-6 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-line bg-white/80'}`}
            >
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${dark ? 'bg-primary-500/15 text-primary-300' : 'bg-primary-50 text-primary-700'}`}
              >
                {i + 1}
              </span>
              <h3 className={`mt-4 text-base font-semibold ${dark ? 'text-white' : 'text-ink'}`}>{step.title}</h3>
              <p className={`mt-2 text-sm leading-relaxed ${dark ? 'text-white/50' : 'text-ink-muted'}`}>
                {step.description}
              </p>
            </div>
          </FadeIn>
        ))}
      </div>
    </SectionShell>
  );
}

function BusinessTypes() {
  const dark = useDark();
  const go = useLandingNav();

  return (
    <SectionShell id="business-types">
      <FadeIn className="mx-auto max-w-2xl text-center">
        <Eyebrow dark={dark}>Supported business types</Eyebrow>
        <h2 className={`mt-5 text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>
          Choose the system that matches how you sell
        </h2>
        <p className={`mt-4 text-lg ${dark ? 'text-white/50' : 'text-ink-muted'}`}>
          Nezhin POS is one platform. During registration you pick Retail, Food & Beverage, or Wholesale — and
          your dashboard adapts to that workflow.
        </p>
      </FadeIn>

      <div className="mt-14 grid gap-5 md:grid-cols-2">
        {BUSINESS_TYPE_CARDS.map((card, i) => (
          <FadeIn key={card.id} delay={i * 0.05}>
            <div
              className={`flex h-full flex-col rounded-2xl border p-7 backdrop-blur-md ${dark ? 'border-white/10 bg-white/[0.04]' : 'border-line bg-white/75'}`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${dark ? 'border-white/10 bg-white/[0.04] text-primary-300' : 'border-line bg-canvas-raised text-primary-600'}`}
                >
                  <card.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${dark ? 'text-white' : 'text-ink'}`}>{card.title}</h3>
                  <p className={`mt-1 text-sm leading-relaxed ${dark ? 'text-white/50' : 'text-ink-muted'}`}>
                    {card.description}
                  </p>
                </div>
              </div>
              <FeatureList items={card.features} dark={dark} />
              {card.ctaType ? (
                <button
                  type="button"
                  onClick={() => go(`/get-started?type=${card.ctaType}`)}
                  className={`mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-300`}
                >
                  Start with {card.title}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </FadeIn>
        ))}
      </div>
    </SectionShell>
  );
}

function CoreFeatures() {
  const dark = useDark();

  return (
    <SectionShell id="features" className={dark ? '' : 'bg-canvas-raised/40'}>
      <FadeIn className="max-w-2xl">
        <Eyebrow dark={dark}>Core platform features</Eyebrow>
        <h2 className={`mt-5 text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>
          Everything included in the Nezhin POS platform
        </h2>
        <p className={`mt-4 text-lg ${dark ? 'text-white/50' : 'text-ink-muted'}`}>
          Shared capabilities across Retail, F&B, and Wholesale — with modules enabled by your business type and package.
        </p>
      </FadeIn>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CORE_FEATURE_GROUPS.map((group, i) => (
          <FadeIn key={group.title} delay={i * 0.04}>
            <div
              className={`h-full rounded-2xl border p-6 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-line bg-white/80'}`}
            >
              <h3 className={`text-base font-semibold ${dark ? 'text-white' : 'text-ink'}`}>{group.title}</h3>
              <FeatureList items={group.items} dark={dark} />
            </div>
          </FadeIn>
        ))}
      </div>
    </SectionShell>
  );
}

function SolutionSection({
  id,
  eyebrow,
  title,
  description,
  features,
  ctaLabel,
  ctaType,
  reverse = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaType: string;
  reverse?: boolean;
}) {
  const dark = useDark();
  const go = useLandingNav();

  return (
    <div id={id} className="scroll-mt-24 py-10 sm:py-14">
      <div
        className={`grid items-center gap-12 lg:grid-cols-2 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}
      >
        <FadeIn>
          <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
          <h3 className={`mt-4 text-2xl font-semibold tracking-tight sm:text-3xl ${dark ? 'text-white' : 'text-ink'}`}>
            {title}
          </h3>
          <p className={`mt-4 text-base leading-relaxed ${dark ? 'text-white/50' : 'text-ink-muted'}`}>
            {description}
          </p>
          <button
            type="button"
            onClick={() => go(`/get-started?type=${ctaType}`)}
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </FadeIn>
        <FadeIn delay={0.08}>
          <div
            className={`rounded-2xl border p-7 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-line bg-white/80'}`}
          >
            <FeatureList items={features} dark={dark} />
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function Solutions() {
  const dark = useDark();

  return (
    <SectionShell id="solutions">
      <FadeIn className="mx-auto max-w-2xl text-center">
        <Eyebrow dark={dark}>Tailored workflows</Eyebrow>
        <h2 className={`mt-5 text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>
          Built for how each business type operates
        </h2>
      </FadeIn>

      <div className="mt-6 divide-y divide-line dark:divide-white/10">
        <SolutionSection
          id="retail"
          eyebrow="Retail POS"
          title="Retail POS for fast daily sales"
          description="Manage your shop with barcode checkout, inventory control, customer debt, purchase orders, and clear reports."
          features={RETAIL_FEATURES}
          ctaLabel="Start with Retail POS"
          ctaType="RETAIL"
        />
        <SolutionSection
          id="fnb"
          eyebrow="Food & Beverage"
          title="Food & Beverage POS for restaurants and cafés"
          description="Control tables, orders, menu items, kitchen tickets, modifiers, recipes, and payments from one simple system."
          features={FNB_FEATURES}
          ctaLabel="Start with F&B POS"
          ctaType="FOOD_BEVERAGE"
          reverse
        />
        <SolutionSection
          id="wholesale"
          eyebrow="Wholesale / B2B"
          title="Wholesale POS for distributors and B2B companies"
          description="Create quotations, proforma invoices, official invoices, bulk pricing, payment terms, delivery notes, and customer statements."
          features={WHOLESALE_FEATURES}
          ctaLabel="Start with Wholesale POS"
          ctaType="WHOLESALE"
        />
      </div>
    </SectionShell>
  );
}

function LandingPlanCard({
  plan,
  dark,
  onSelect,
}: {
  plan: PublicPlan;
  dark: boolean;
  onSelect: () => void;
}) {
  const price = plan.monthlyPrice;
  const features = Object.entries(plan.features ?? {})
    .filter(([, v]) => v)
    .slice(0, 5)
    .map(([k]) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

  return (
    <div
      className={`flex h-full flex-col rounded-2xl border p-6 ${dark ? 'border-white/10 bg-white/[0.04]' : 'border-line bg-white/80'}`}
    >
      <h4 className={`text-lg font-semibold ${dark ? 'text-white' : 'text-ink'}`}>{plan.name}</h4>
      {plan.description ? (
        <p className={`mt-1 text-sm ${dark ? 'text-white/45' : 'text-ink-muted'}`}>{plan.description}</p>
      ) : null}
      <div className="mt-4">
        {price ? (
          <>
            <span className={`text-3xl font-semibold ${dark ? 'text-white' : 'text-ink'}`}>${price}</span>
            <span className={`ml-1 text-sm ${dark ? 'text-white/40' : 'text-ink-faint'}`}>/ month</span>
          </>
        ) : (
          <span className={`text-sm ${dark ? 'text-white/45' : 'text-ink-muted'}`}>See pricing page</span>
        )}
      </div>
      <ul className="mt-5 flex-1 space-y-2 text-sm">
        <li className={`flex items-center gap-2 ${dark ? 'text-white/55' : 'text-ink-muted'}`}>
          <Users className="h-4 w-4 shrink-0 text-primary-500" />
          {plan.maxUsers == null ? 'Unlimited users' : `Up to ${plan.maxUsers} users`}
        </li>
        <li className={`flex items-center gap-2 ${dark ? 'text-white/55' : 'text-ink-muted'}`}>
          <GitBranch className="h-4 w-4 shrink-0 text-primary-500" />
          {plan.maxBranches == null ? 'Unlimited branches' : `Up to ${plan.maxBranches} branches`}
        </li>
        <li className={`flex items-center gap-2 ${dark ? 'text-white/55' : 'text-ink-muted'}`}>
          <Monitor className="h-4 w-4 shrink-0 text-primary-500" />
          {plan.maxDevices == null ? 'Unlimited devices' : `Up to ${plan.maxDevices} devices`}
        </li>
        {plan.allowsDesktopDownload ? (
          <li className={`flex items-center gap-2 ${dark ? 'text-white/55' : 'text-ink-muted'}`}>
            <Check className="h-4 w-4 shrink-0 text-primary-500" />
            Desktop app included
          </li>
        ) : null}
        {features.map((f) => (
          <li key={f} className={`flex items-center gap-2 ${dark ? 'text-white/55' : 'text-ink-muted'}`}>
            <Check className="h-4 w-4 shrink-0 text-primary-500" />
            {f}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSelect}
        className={`mt-6 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${dark ? 'border border-white/15 text-white hover:bg-white/5' : 'border border-line text-ink hover:bg-canvas-raised'}`}
      >
        Choose {plan.name}
      </button>
    </div>
  );
}

function PricingPreview() {
  const dark = useDark();
  const go = useLandingNav();
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<'RETAIL' | 'FOOD_BEVERAGE' | 'WHOLESALE'>('RETAIL');

  useEffect(() => {
    fetchPublicPlans()
      .then((all) =>
        setPlans(
          all
            .filter((p) => p.type === 'SUBSCRIPTION')
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        ),
      )
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const context = PRICING_TYPE_CONTEXT[activeType];

  return (
    <SectionShell id="pricing" className={dark ? '' : 'bg-canvas-raised/40'}>
      <FadeIn className="mx-auto max-w-2xl text-center">
        <Eyebrow dark={dark}>Packages</Eyebrow>
        <h2 className={`mt-5 text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>
          Plans for every business size
        </h2>
        <p className={`mt-4 text-lg ${dark ? 'text-white/50' : 'text-ink-muted'}`}>
          Starter, Business, and Pro packages with clear limits on users, branches, devices, and enabled modules. Prices
          load from our live plan catalog.
        </p>
      </FadeIn>

      <FadeIn className="mt-10 flex flex-wrap justify-center gap-2">
        {(Object.keys(PRICING_TYPE_CONTEXT) as Array<keyof typeof PRICING_TYPE_CONTEXT>).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveType(key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeType === key
                ? 'bg-primary-600 text-white'
                : dark
                  ? 'border border-white/10 text-white/60 hover:bg-white/5'
                  : 'border border-line text-ink-muted hover:bg-white'
            }`}
          >
            {PRICING_TYPE_CONTEXT[key].label}
          </button>
        ))}
      </FadeIn>

      <FadeIn className="mt-6 text-center">
        <p className={`text-sm ${dark ? 'text-white/45' : 'text-ink-muted'}`}>{context.summary}</p>
      </FadeIn>

      {loading ? (
        <div className="mt-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : plans.length === 0 ? (
        <p className={`mt-12 text-center text-sm ${dark ? 'text-white/45' : 'text-ink-muted'}`}>
          Plans are loading from the server. Visit the full pricing page for details.
        </p>
      ) : (
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <LandingPlanCard key={plan.id} plan={plan} dark={dark} onSelect={() => go('/pricing')} />
          ))}
        </div>
      )}

      <FadeIn className="mt-10 text-center">
        <button
          type="button"
          onClick={() => go('/pricing')}
          className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Choose your package
          <ArrowRight className="h-4 w-4" />
        </button>
      </FadeIn>
    </SectionShell>
  );
}

/** "Prefer a desktop app?" — one-time Desktop Lifetime packages per business type. */
function DesktopLifetimeSection() {
  const dark = useDark();
  const go = useLandingNav();
  const [plans, setPlans] = useState<PublicPlan[]>([]);

  useEffect(() => {
    fetchPublicPlans()
      .then((all) => setPlans(all.filter((p) => p.type === 'ONE_TIME' && p.businessType && p.oneTimePrice)))
      .catch(() => setPlans([]));
  }, []);

  const CARD_META: Record<string, { label: string; icon: typeof Monitor }> = {
    RETAIL: { label: 'Retail Desktop', icon: Monitor },
    FOOD_BEVERAGE: { label: 'F&B Desktop', icon: Monitor },
    WHOLESALE: { label: 'Wholesale Desktop', icon: Monitor },
  };

  // Hybrid Desktop Lifetime is discontinued — only Retail / F&B / Wholesale.
  const visible = plans.filter((p) => p.businessType && p.businessType !== 'HYBRID');

  if (visible.length === 0) return null;

  return (
    <SectionShell id="desktop" className={dark ? '' : 'bg-canvas-raised/40'}>
      <FadeIn className="mx-auto max-w-2xl text-center">
        <Eyebrow dark={dark}>Desktop Lifetime</Eyebrow>
        <h2 className={`mt-5 text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>
          Prefer a desktop app?
        </h2>
        <p className={`mt-4 text-lg ${dark ? 'text-white/50' : 'text-ink-muted'}`}>
          Pay once and use your POS desktop license without monthly subscription. Download and
          activate your POS desktop app for your system type.
        </p>
      </FadeIn>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((plan, i) => {
          const meta = CARD_META[plan.businessType ?? ''] ?? { label: plan.name, icon: Monitor };
          return (
            <FadeIn key={plan.id} delay={i * 0.05}>
              <div className={`flex h-full flex-col rounded-2xl border p-6 ${dark ? 'border-white/10 bg-white/[0.04]' : 'border-line bg-white/80'}`}>
                <div className="flex items-center gap-2">
                  <meta.icon className={`h-5 w-5 ${dark ? 'text-primary-300' : 'text-primary-600'}`} />
                  <h4 className={`text-lg font-semibold ${dark ? 'text-white' : 'text-ink'}`}>{meta.label}</h4>
                </div>
                <div className="mt-4">
                  <span className={`text-3xl font-semibold ${dark ? 'text-white' : 'text-ink'}`}>${plan.oneTimePrice}</span>
                  <span className={`ml-1 text-sm ${dark ? 'text-white/40' : 'text-ink-faint'}`}>one-time payment</span>
                </div>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {[
                    'Unlimited desktop use',
                    'Download desktop app',
                    'Activation license included',
                    'No monthly subscription',
                  ].map((f) => (
                    <li key={f} className={`flex items-center gap-2 ${dark ? 'text-white/55' : 'text-ink-muted'}`}>
                      <Check className="h-4 w-4 shrink-0 text-primary-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => go(`/get-started?type=${plan.businessType}&plan=${plan.code}`)}
                  className="mt-6 rounded-full bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                >
                  Buy Desktop App
                </button>
              </div>
            </FadeIn>
          );
        })}
      </div>

      <FadeIn className="mt-8 text-center">
        <p className={`text-xs ${dark ? 'text-white/35' : 'text-ink-faint'}`}>
          One-time desktop license per system type. Retail, F&B, and Wholesale licenses unlock
          their own modules only.
        </p>
      </FadeIn>
    </SectionShell>
  );
}

function WhyChoose() {
  const dark = useDark();

  return (
    <SectionShell id="why">
      <FadeIn className="mx-auto max-w-2xl text-center">
        <Eyebrow dark={dark}>Why Nezhin POS</Eyebrow>
        <h2 className={`mt-5 text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>
          Why businesses choose Nezhin POS
        </h2>
      </FadeIn>
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {WHY_CHOOSE.map((item, i) => (
          <FadeIn key={item.title} delay={i * 0.04}>
            <div
              className={`h-full rounded-2xl border p-6 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-line bg-white/80'}`}
            >
              <item.icon className={`h-5 w-5 ${dark ? 'text-primary-300' : 'text-primary-600'}`} />
              <h3 className={`mt-4 text-base font-semibold ${dark ? 'text-white' : 'text-ink'}`}>{item.title}</h3>
              <p className={`mt-2 text-sm leading-relaxed ${dark ? 'text-white/45' : 'text-ink-muted'}`}>
                {item.desc}
              </p>
            </div>
          </FadeIn>
        ))}
      </div>
    </SectionShell>
  );
}

function SecuritySection() {
  const dark = useDark();
  const points = [
    'clientId-based tenant isolation',
    'Role permissions on every protected route',
    'Email verification with OTP',
    'Password reset with OTP',
    'Secure login with session validation',
    'No cross-client data access',
  ];

  return (
    <SectionShell id="security" className={dark ? '' : 'bg-canvas-raised/40'}>
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <FadeIn>
          <Eyebrow dark={dark}>Security</Eyebrow>
          <h2 className={`mt-5 text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>
            Your business data stays private
          </h2>
          <p className={`mt-4 text-lg leading-relaxed ${dark ? 'text-white/50' : 'text-ink-muted'}`}>
            Every client account is isolated. Products, customers, invoices, users, reports, and settings are separated
            by client account.
          </p>
        </FadeIn>
        <FadeIn delay={0.08}>
          <div
            className={`rounded-2xl border p-7 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-line bg-white/80'}`}
          >
            <FeatureList items={points} dark={dark} />
          </div>
        </FadeIn>
      </div>
    </SectionShell>
  );
}

function NotificationsSection() {
  const dark = useDark();

  return (
    <SectionShell id="notifications">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <FadeIn>
          <Eyebrow dark={dark}>Notifications</Eyebrow>
          <h2 className={`mt-5 text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>
            Smart email notifications
          </h2>
          <p className={`mt-4 text-lg ${dark ? 'text-white/50' : 'text-ink-muted'}`}>
            Owners can choose who receives important email notifications — Owner, General Manager, Co-Manager, or
            specific users when configured.
          </p>
        </FadeIn>
        <FadeIn delay={0.08}>
          <FeatureList items={NOTIFICATION_TYPES} dark={dark} />
        </FadeIn>
      </div>
    </SectionShell>
  );
}

function RolesSection() {
  const dark = useDark();

  return (
    <SectionShell id="roles" className={dark ? '' : 'bg-canvas-raised/40'}>
      <FadeIn className="max-w-2xl">
        <Eyebrow dark={dark}>Roles & permissions</Eyebrow>
        <h2 className={`mt-5 text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>
          Control what every user can access
        </h2>
        <p className={`mt-4 text-lg ${dark ? 'text-white/50' : 'text-ink-muted'}`}>
          Each role has specific permissions, so employees only access the tools they need.
        </p>
      </FadeIn>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {ROLE_GROUPS.map((group, i) => (
          <FadeIn key={group.title} delay={i * 0.05}>
            <div
              className={`rounded-2xl border p-6 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-line bg-white/80'}`}
            >
              <h3 className={`text-sm font-semibold uppercase tracking-wide ${dark ? 'text-white/70' : 'text-ink-muted'}`}>
                {group.title}
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.roles.map((role) => (
                  <span
                    key={role}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${dark ? 'bg-white/5 text-white/70' : 'bg-canvas-raised text-ink-muted'}`}
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </SectionShell>
  );
}

function FAQ() {
  const dark = useDark();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <SectionShell id="faq">
      <FadeIn className="mx-auto max-w-2xl text-center">
        <Eyebrow dark={dark}>FAQ</Eyebrow>
        <h2 className={`mt-5 text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>
          Frequently asked questions
        </h2>
      </FadeIn>
      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {FAQ_ITEMS.map((item, i) => {
          const open = openIndex === i;
          return (
            <FadeIn key={item.q} delay={i * 0.03}>
              <div
                className={`overflow-hidden rounded-2xl border ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-line bg-white/80'}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold ${dark ? 'text-white' : 'text-ink'}`}
                >
                  {item.q}
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open ? (
                  <div className={`border-t px-5 py-4 text-sm leading-relaxed ${dark ? 'border-white/8 text-white/55' : 'border-line text-ink-muted'}`}>
                    {item.a}
                  </div>
                ) : null}
              </div>
            </FadeIn>
          );
        })}
      </div>
    </SectionShell>
  );
}

function FinalCTA() {
  const dark = useDark();
  const go = useLandingNav();

  return (
    <SectionShell id="cta" className="pb-28">
      <FadeIn>
        <div
          className={`relative overflow-hidden rounded-3xl border px-8 py-16 text-center sm:px-16 ${dark ? 'border-white/10 bg-white/[0.04]' : 'border-line bg-white/85'}`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_50%_0%,rgba(249,115,22,0.14),transparent)]" />
          <div className="relative">
            <h2 className={`text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>
              Start managing your business with Nezhin POS
            </h2>
            <p className={`mx-auto mt-4 max-w-xl text-lg ${dark ? 'text-white/50' : 'text-ink-muted'}`}>
              Choose your business type, select a package, verify your email, and start using your dashboard.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => go('/get-started')}
                className="group inline-flex items-center gap-2 rounded-full bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => go('/pricing')}
                className={`inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold ${dark ? 'border-white/15 text-white hover:bg-white/5' : 'border-line text-ink hover:bg-canvas-raised'}`}
              >
                View Packages
              </button>
            </div>
          </div>
        </div>
      </FadeIn>
    </SectionShell>
  );
}

function Footer() {
  const dark = useDark();
  const cols = [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '#features' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Download', href: '/download' },
      ],
    },
    {
      title: 'Account',
      links: [
        { label: 'Get Started', href: '/get-started' },
        { label: 'Sign in', href: '/login' },
      ],
    },
  ];

  return (
    <footer className={`relative z-10 border-t py-14 ${dark ? 'border-white/8 bg-canvas/70' : 'border-line bg-white/70'}`}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
                <BarChart3 className="h-4 w-4" />
              </div>
              <span className={`text-[15px] font-semibold ${dark ? 'text-white' : 'text-ink'}`}>Nezhin POS</span>
            </div>
            <p className={`mt-4 max-w-sm text-sm leading-relaxed ${dark ? 'text-white/35' : 'text-ink-faint'}`}>
              One SaaS POS platform for Retail, Food & Beverage, and Wholesale businesses.
            </p>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${dark ? 'text-white/35' : 'text-ink-faint'}`}>
                {col.title}
              </h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith('#') ? (
                      <a
                        href={l.href}
                        className={`text-sm transition-colors ${dark ? 'text-white/45 hover:text-white' : 'text-ink-muted hover:text-ink'}`}
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        to={l.href}
                        className={`text-sm transition-colors ${dark ? 'text-white/45 hover:text-white' : 'text-ink-muted hover:text-ink'}`}
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className={`mt-12 border-t pt-7 text-center text-sm ${dark ? 'border-white/8 text-white/30' : 'border-line text-ink-faint'}`}>
          © {new Date().getFullYear()} Nezhin POS. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);

  const navigateWithExit = useCallback(
    (path: string) => {
      if (reduce) {
        navigate(path);
        return;
      }
      setExiting(true);
      window.setTimeout(() => navigate(path), 320);
    },
    [reduce, navigate],
  );

  return (
    <LandingNavContext.Provider value={navigateWithExit}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: exiting ? 0 : 1 }}
        transition={{ duration: exiting ? 0.32 : 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative min-h-screen overflow-x-hidden bg-canvas font-sans text-ink antialiased"
      >
        <Navbar />
        <main className="relative">
          <Hero />
          <OnboardingSteps />
          <BusinessTypes />
          <CoreFeatures />
          <Solutions />
          <PricingPreview />
          <DesktopLifetimeSection />
          <WhyChoose />
          <SecuritySection />
          <NotificationsSection />
          <RolesSection />
          <FAQ />
          <FinalCTA />
        </main>
        <Footer />
      </motion.div>
    </LandingNavContext.Provider>
  );
}
