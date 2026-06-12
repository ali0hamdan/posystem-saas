import { useAuthStore } from '@/stores/auth-store';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';

export function usePermissions() {
  const permissions = useAuthStore((s) => s.permissions);

  return {
    permissions,
    can: (permission: string) => hasPermission(permissions, permission),
    canAny: (required: string | string[]) => hasAnyPermission(permissions, required),
  };
}
