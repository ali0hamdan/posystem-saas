import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { permissionForPath } from '@/config/route-permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { AccessDeniedPage } from '@/pages/AccessDeniedPage';

/** Enforces route-level permissions for the current pathname. */
export function RoutePermissionGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { canAny } = usePermissions();
  const required = permissionForPath(pathname);

  if (required && !canAny(required)) {
    return <AccessDeniedPage />;
  }

  return <>{children}</>;
}
