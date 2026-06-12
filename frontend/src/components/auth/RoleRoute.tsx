import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import type { UserRole } from '@/types/auth';
import { roleMatches } from '@/lib/permissions';

type RoleRouteProps = {
  children: ReactNode;
  allow: UserRole[];
};

export { roleMatches };

export function RoleRoute({ children, allow }: RoleRouteProps) {
  const role = useAuthStore((s) => s.user?.role);

  if (!roleMatches(role, allow)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
