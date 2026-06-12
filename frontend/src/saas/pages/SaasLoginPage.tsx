import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldError, FieldLabel, TextInput } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { isSaasAccessToken } from '@/lib/saas-auth';
import { saasLogin } from '@/saas/api/saas-auth.api';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { useSaasAuthHydrated } from '@/saas/hooks/use-saas-auth-hydrated';
import { useSaasAuthStore } from '@/saas/stores/saas-auth-store';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;


export function SaasLoginPage() {
  const hydrated = useSaasAuthHydrated();
  const token = useSaasAuthStore((s) => s.accessToken);
  const setSession = useSaasAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/saas/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: saasLogin,
    onSuccess: (data) => {
      setSession(data.accessToken, data.admin);
      toast.success(`Welcome, ${data.admin.name}`);
      navigate(from.startsWith('/saas') ? from : '/saas/dashboard', { replace: true });
    },
    onError: (err) => toast.error(getSaasApiErrorMessage(err, 'Unable to sign in')),
  });

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-ink-muted">
        Loading…
      </div>
    );
  }

  if (token && isSaasAccessToken(token)) {
    return <Navigate to="/saas/dashboard" replace />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-canvas via-canvas to-surface-muted px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle compact />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-900/50">
            <Shield className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Platform Admin</h1>
          <p className="mt-2 text-sm text-ink-muted">Sign in with your SaaS operator account</p>
        </div>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate({ email: v.email.trim().toLowerCase(), password: v.password }))}
          className="rounded-2xl border border-line bg-surface p-8 shadow-xl backdrop-blur"
        >
          <div className="space-y-5">
            <div>
              <FieldLabel htmlFor="email">
                Email
              </FieldLabel>
              <TextInput
                id="email"
                type="email"
                autoComplete="email"
                className="border-line bg-surface-muted text-ink placeholder:text-ink-faint"
                {...register('email')}
              />
              <FieldError message={errors.email?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="password">
                Password
              </FieldLabel>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                className="border-line bg-surface-muted text-ink"
                {...register('password')}
              />
              <FieldError message={errors.password?.message} />
            </div>
          </div>
          <Button type="submit" variant="primary" size="lg" className="mt-8 w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Signing in…' : 'Sign in to platform'}
          </Button>
        </form>
      </div>
    </div>
  );
}
