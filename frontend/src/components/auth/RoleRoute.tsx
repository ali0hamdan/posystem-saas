import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import type { UserRole } from '@/types/auth';

type RoleRouteProps = {
  children: ReactNode;
  allow: UserRole[];
};

export function RoleRoute({ children, allow }: RoleRouteProps) {
  const role = useAuthStore((s) => s.user?.role);

  if (!role || !allow.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
