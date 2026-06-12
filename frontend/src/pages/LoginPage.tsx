import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { BarChart3, Package, ShieldCheck, Zap, Home } from 'lucide-react';
import { login } from '@/api/auth.api';
import { getApiErrorMessage } from '@/api/client';
import { BYPASS_LICENSE } from '@/lib/env';
import { isStoreAccessToken } from '@/lib/store-auth';
import { useAuthStore } from '@/stores/auth-store';
import { useBranchStore } from '@/stores/branch-store';
import { useLicenseStore } from '@/stores/license-store';
import { useAuthHydrated } from '@/hooks/use-auth-hydrated';
import { useLicenseHydrated } from '@/hooks/use-license-hydrated';
import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen';
import { AuthShell, useAuthTransition } from '@/components/auth/AuthShell';
import { defaultDashboardPath } from '@/lib/business-routing';
import type { BusinessType } from '@/types/tenant-context';
import { Button } from '@/components/ui/button';
import { TextInput, FieldLabel, FieldError } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const schema = z.object({
  clientSlug: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

function safePostLoginPath(from: string, businessType?: BusinessType, nextDashboardUrl?: string): string {
  if (!from.startsWith('/') || from === '/login') {
    return nextDashboardUrl ?? defaultDashboardPath(businessType);
  }
  return from;
}

const features = [
  { icon: Zap, label: 'Fast checkout', desc: 'Barcode scanning, quick-add, keyboard shortcuts' },
  { icon: Package, label: 'Live inventory', desc: 'Real-time stock levels across all branches' },
  { icon: BarChart3, label: 'Sales analytics', desc: 'Revenue, profit, and trends at a glance' },
  { icon: ShieldCheck, label: 'Role-based access', desc: 'Owner, admin, and cashier permission levels' },
];

export function LoginPage() {
  const hydrated = useAuthHydrated();
  const licenseHydrated = useLicenseHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const licenseToken = useLicenseStore((s) => s.token);
  const clientSlugHint = useLicenseStore((s) => s.clientSlug);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const activated = Boolean((location.state as { activated?: boolean } | null)?.activated);
  const paymentSuccess = Boolean((location.state as { paymentSuccess?: boolean } | null)?.paymentSuccess);
  const loginEmailHint = (location.state as { email?: string } | null)?.email ?? '';
  const target = safePostLoginPath(from);

  const t = useAuthTransition();

  useEffect(() => {
    if (hydrated && accessToken && !isStoreAccessToken(accessToken)) {
      clearAuth();
    }
  }, [hydrated, accessToken, clearAuth]);

  useEffect(() => {
    if (activated) {
      toast.success('Device activated. Sign in with your store account.');
    }
    if (paymentSuccess) {
      toast.success('Payment successful. Sign in with your email and password.');
    }
  }, [activated, paymentSuccess]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { clientSlug: clientSlugHint ?? '', email: loginEmailHint, password: '' },
  });

  const mutation = useMutation({
    mutationFn: login,
    retry: false,
    onSuccess: (data) => {
      setSession(data.accessToken, data.user, data.permissions ?? []);
      useBranchStore.getState().hydrateBranches(data.branches ?? []);
      navigate(safePostLoginPath(from, data.businessType, data.nextDashboardUrl), { replace: true });
    },
  });

  if (!hydrated || !licenseHydrated) {
    return <AuthLoadingScreen message="Starting app…" />;
  }
  if (!BYPASS_LICENSE && !licenseToken) {
    return <Navigate to="/activate" replace state={{ from: '/login' }} />;
  }
  if (isStoreAccessToken(accessToken)) {
    return <Navigate to={target} replace />;
  }

  const left = (
    <motion.div variants={t.vContainer} initial="hidden" animate="enter" className="relative flex flex-1 flex-col justify-between px-10 py-12">
      <motion.div variants={t.vItem} className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white shadow-lg">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Nezhin POS</p>
          <p className="text-[11px] text-white/40">Inventory & Point of Sale</p>
        </div>
      </motion.div>

      <motion.div variants={t.vContainer}>
        <motion.p variants={t.vItem} className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-primary-400">
          Store management
        </motion.p>
        <motion.h1 variants={t.vItem} className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
          Run your store
          <br />
          <span className="bg-gradient-to-r from-primary-400 to-primary-300 bg-clip-text text-transparent">with confidence.</span>
        </motion.h1>
        <motion.p variants={t.vItem} className="mt-4 text-[15px] leading-relaxed text-white/50">
          A complete POS and inventory system for retail and restaurants — from checkout to reports, all in one place.
        </motion.p>

        <motion.ul variants={t.vContainer} className="mt-10 space-y-5">
          {features.map(({ icon: Icon, label, desc }) => (
            <motion.li key={label} variants={t.vItem} className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                <Icon className="h-4 w-4 text-primary-400" aria-hidden />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white/90">{label}</p>
                <p className="text-[12px] text-white/40">{desc}</p>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </motion.div>

      <motion.p variants={t.vItem} className="text-[11px] text-white/20">
        © {new Date().getFullYear()} Nezhin POS. All rights reserved.
      </motion.p>
    </motion.div>
  );

  const right = (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle compact />
      </div>

      <motion.div variants={t.vContainer} initial="hidden" animate="enter" className="w-full max-w-sm">
        <motion.div variants={t.vItem} className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
            <BarChart3 className="h-4 w-4" />
          </div>
          <p className="font-display text-sm font-semibold text-ink">Nezhin POS</p>
        </motion.div>

        <motion.div variants={t.vItem} className="mb-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Welcome back</h2>
          <p className="mt-1.5 text-sm text-ink-muted">Sign in with your store credentials to continue.</p>
        </motion.div>

        {mutation.isError ? (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-800 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300"
          >
            {getApiErrorMessage(mutation.error, 'Unable to sign in. Check your credentials and try again.')}
          </div>
        ) : null}

        <motion.form
          variants={t.vContainer}
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-5"
        >
          {clientSlugHint ? (
            <motion.div variants={t.vItem}>
              <FieldLabel htmlFor="clientSlug">Store code</FieldLabel>
              <TextInput id="clientSlug" autoComplete="organization" placeholder="e.g. demo-store" {...register('clientSlug')} />
              <p className="mt-1 text-xs text-ink-muted">From your activation email — identifies which store to connect.</p>
            </motion.div>
          ) : null}

          <motion.div variants={t.vItem}>
            <FieldLabel htmlFor="email">Email address</FieldLabel>
            <TextInput id="email" type="email" autoComplete="email" placeholder="you@business.com" {...register('email')} />
            <FieldError message={errors.email?.message} />
          </motion.div>

          <motion.div variants={t.vItem}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <button
                type="button"
                onClick={() => t.goAuth('/forgot-password')}
                className="text-xs text-primary-600 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <PasswordInput id="password" autoComplete="current-password" placeholder="••••••••" {...register('password')} />
            <FieldError message={errors.password?.message} />
          </motion.div>

          <motion.div variants={t.vItem}>
            <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </motion.div>
        </motion.form>

        <motion.div variants={t.vItem} className="mt-6 flex flex-col items-center gap-2 text-xs text-ink-faint">
          <p>
            Don't have an account?{' '}
            <button onClick={() => t.goAuth('/get-started')} className="text-primary-600 hover:underline font-medium">
              Get started
            </button>
          </p>
          <button onClick={t.goHome} className="flex items-center gap-1 hover:text-ink-muted transition-colors">
            <Home className="h-3 w-3" /> Back to home
          </button>
        </motion.div>
      </motion.div>
    </div>
  );

  return <AuthShell t={t} left={left} right={right} />;
}
