import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { AccessDeniedPage } from '@/pages/AccessDeniedPage';

type PermissionRouteProps = {
  children: ReactNode;
  /** Single permission or any-of list */
  require: string | string[];
};

export function PermissionRoute({ children, require }: PermissionRouteProps) {
  const { canAny } = usePermissions();

  if (!canAny(require)) {
    return <AccessDeniedPage />;
  }

  return <>{children}</>;
}
