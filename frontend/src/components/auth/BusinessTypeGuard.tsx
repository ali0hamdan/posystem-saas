import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useBusinessType, useFnbEnabled, useWholesaleEnabled } from '@/hooks/use-tenant-context';
import { defaultDashboardPath } from '@/lib/business-routing';
import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen';

type GuardMode = 'retail-exclusive' | 'fnb' | 'wholesale';

export function BusinessTypeGuard({ mode, children }: { mode: GuardMode; children: ReactNode }) {
  const location = useLocation();
  const businessType = useBusinessType();
  const fnbEnabled = useFnbEnabled();
  const wholesaleEnabled = useWholesaleEnabled();

  if (businessType === undefined) {
    return <AuthLoadingScreen message="Loading your workspace…" />;
  }

  if (mode === 'retail-exclusive') {
    if (businessType === 'FOOD_BEVERAGE' || businessType === 'WHOLESALE') {
      return <Navigate to={defaultDashboardPath(businessType)} replace state={{ from: location.pathname }} />;
    }
    return <>{children}</>;
  }

  if (mode === 'fnb') {
    const isFnbBusiness = businessType === 'FOOD_BEVERAGE' || businessType === 'HYBRID';
    if (!isFnbBusiness || !fnbEnabled) {
      return (
        <Navigate
          to={defaultDashboardPath(businessType)}
          replace
          state={{ fnbBlocked: true, from: location.pathname }}
        />
      );
    }
    return <>{children}</>;
  }

  if (mode === 'wholesale') {
    const isWholesaleBusiness = businessType === 'WHOLESALE' || businessType === 'HYBRID';
    if (!isWholesaleBusiness || !wholesaleEnabled) {
      return (
        <Navigate
          to={defaultDashboardPath(businessType)}
          replace
          state={{ wholesaleBlocked: true, from: location.pathname }}
        />
      );
    }
    return <>{children}</>;
  }

  return <>{children}</>;
}
