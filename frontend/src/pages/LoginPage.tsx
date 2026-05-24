import { useEffect, useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Button } from '@/components/ui/button';
import { TextInput, FieldLabel, FieldError } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const schema = z.object({
  clientSlug: z.string().optional(),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

function safePostLoginPath(from: string): string {
  if (!from.startsWith('/') || from === '/login') return '/dashboard';
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
  const from = (location.state as { from?: string; fromLanding?: boolean } | null)?.from ?? '/dashboard';
  const activated = Boolean((location.state as { activated?: boolean } | null)?.activated);
  const fromLanding = Boolean((location.state as { fromLanding?: boolean } | null)?.fromLanding);
  const target = safePostLoginPath(from);
  const [leaving, setLeaving] = useState(false);

  const goWithCurtain = useCallback((path: string) => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => navigate(path, { state: { fromLanding: true } }), 550);
  }, [leaving, navigate]);

  useEffect(() => {
    if (hydrated && accessToken && !isStoreAccessToken(accessToken)) {
      clearAuth();
    }
  }, [hydrated, accessToken, clearAuth]);

  useEffect(() => {
    if (activated) {
      toast.success('Device activated. Sign in with your store account.');
    }
  }, [activated]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientSlug: clientSlugHint ?? '',
      username: '',
      password: '',
    },
  });

  const mutation = useMutation({
    mutationFn: login,
    retry: false,
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
      useBranchStore.getState().hydrateBranches(data.branches ?? []);
      navigate(target, { replace: true });
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

  const anim = fromLanding;
  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <>
      {/* Curtain for navigating away from login */}
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

      {/* Indigo overlay that slides out left — continues the landing curtain seamlessly */}
      {anim && (
        <motion.div
          className="fixed inset-0 z-[9999] pointer-events-none"
          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' }}
          initial={{ x: 0 }}
          animate={{ x: '-100%' }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.76, 0, 0.24, 1] }}
        />
      )}

      <div className="flex min-h-screen overflow-hidden">

        {/* ── Left branding panel ────────────────────────────────── */}
        <motion.div
          className="relative hidden flex-col overflow-hidden bg-[#090e1a] lg:flex lg:w-[420px] xl:w-[480px]"
          initial={anim ? { x: '-100%' } : false}
          animate={{ x: 0 }}
          transition={{ duration: 0.75, ease }}
        >
          {/* subtle grid pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary-600/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary-500/10 blur-3xl" />

          <div className="relative flex flex-1 flex-col justify-between px-10 py-12">
            {/* Brand mark */}
            <motion.div
              className="flex items-center gap-3"
              initial={anim ? { opacity: 0, y: 16 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.45, ease }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-bold text-white shadow-lg">
                POS
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Stock POS</p>
                <p className="text-[11px] text-white/40">Inventory & Point of Sale</p>
              </div>
            </motion.div>

            {/* Hero copy */}
            <motion.div
              initial={anim ? { opacity: 0, y: 24 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55, ease }}
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-primary-400">
                Store management
              </p>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
                Run your store
                <br />
                <span className="bg-gradient-to-r from-primary-400 to-primary-300 bg-clip-text text-transparent">
                  with confidence.
                </span>
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-white/50">
                A complete POS and inventory system built for retail — from checkout to reports, all in one place.
              </p>

              <ul className="mt-10 space-y-5">
                {features.map(({ icon: Icon, label, desc }, i) => (
                  <motion.li
                    key={label}
                    className="flex items-start gap-3.5"
                    initial={anim ? { opacity: 0, x: -16 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: 0.65 + i * 0.07, ease }}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                      <Icon className="h-4 w-4 text-primary-400" aria-hidden />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-white/90">{label}</p>
                      <p className="text-[12px] text-white/40">{desc}</p>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <p className="text-[11px] text-white/20">© {new Date().getFullYear()} Stock POS. All rights reserved.</p>
          </div>
        </motion.div>

        {/* ── Right form panel ───────────────────────────────────── */}
        <motion.div
          className="relative flex flex-1 flex-col items-center justify-center bg-canvas px-6 py-12 sm:px-12"
          initial={anim ? { x: '8%', opacity: 0 } : false}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.1, ease }}
        >
          <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
            <ThemeToggle compact />
          </div>

          <div className="w-full max-w-sm">
            {/* Mobile brand */}
            <motion.div
              className="mb-8 flex items-center gap-3 lg:hidden"
              initial={anim ? { opacity: 0, y: 12 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease }}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-xs font-bold text-white">
                POS
              </div>
              <p className="font-display text-sm font-semibold text-ink">Stock POS</p>
            </motion.div>

            <motion.div
              className="mb-8"
              initial={anim ? { opacity: 0, y: 16 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3, ease }}
            >
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
              onSubmit={handleSubmit((values) => mutation.mutate(values))}
              className="space-y-5"
              initial={anim ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.4, ease }}
            >
              {clientSlugHint ? (
                <div>
                  <FieldLabel htmlFor="clientSlug">Store code</FieldLabel>
                  <TextInput
                    id="clientSlug"
                    autoComplete="organization"
                    placeholder="e.g. demo-store"
                    {...register('clientSlug')}
                  />
                  <p className="mt-1 text-xs text-ink-muted">
                    From your activation email — identifies which store to connect.
                  </p>
                </div>
              ) : null}

              <div>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <TextInput
                  id="username"
                  autoComplete="username"
                  placeholder="e.g. cashier01"
                  {...register('username')}
                />
                <FieldError message={errors.username?.message} />
              </div>

              <div>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <TextInput
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                />
                <FieldError message={errors.password?.message} />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="mt-2 w-full"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            </motion.form>

            <motion.div
              className="mt-6 flex flex-col items-center gap-2 text-xs text-ink-faint"
              initial={anim ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.55, ease }}
            >
              <p>
                Don't have an account?{' '}
                <button
                  onClick={() => goWithCurtain('/get-started')}
                  className="text-primary-600 hover:underline font-medium"
                >
                  Get started
                </button>
              </p>
              <button
                onClick={() => goWithCurtain('/')}
                className="flex items-center gap-1 hover:text-ink-muted transition-colors"
              >
                <Home className="h-3 w-3" /> Back to home
              </button>
            </motion.div>
          </div>
        </motion.div>

      </div>
    </>
  );
}
