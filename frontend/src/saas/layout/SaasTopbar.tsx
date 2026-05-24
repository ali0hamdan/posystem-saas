import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { saasLogout } from '@/saas/api/saas-auth.api';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { useSaasAuthStore } from '@/saas/stores/saas-auth-store';
import { SaasStatusBadge } from '@/saas/components/SaasStatusBadge';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function SaasTopbar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const admin = useSaasAuthStore((s) => s.admin);
  const clearAuth = useSaasAuthStore((s) => s.clearAuth);

  const logoutMutation = useMutation({
    mutationFn: saasLogout,
    onSettled: () => {
      clearAuth();
      qc.removeQueries({ queryKey: ['saas'] });
      navigate('/saas/login', { replace: true });
      toast.success('Signed out');
    },
    onError: (err) => {
      clearAuth();
      qc.removeQueries({ queryKey: ['saas'] });
      navigate('/saas/login', { replace: true });
      toast.error(getSaasApiErrorMessage(err, 'Signed out locally'));
    },
  });

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface/90 px-6 backdrop-blur">
      <div />
      <div className="flex items-center gap-4">
        <ThemeToggle compact />
        {admin ? (
          <div className="text-right">
            <p className="text-sm font-medium text-ink">{admin.name}</p>
            <p className="text-xs text-ink-muted">{admin.email}</p>
          </div>
        ) : null}
        {admin?.role ? <SaasStatusBadge status={admin.role} /> : null}
        <Button
          variant="ghost"
          size="sm"
          className="text-ink-muted hover:bg-canvas-raised hover:text-ink"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}

