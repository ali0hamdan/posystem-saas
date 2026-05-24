import { useMemo } from 'react';
import { useSaasAuthStore } from '@/saas/stores/saas-auth-store';
import type { SaasAdminRole } from '@/saas/types';

export type SaasPermissions = {
  role: SaasAdminRole | undefined;
  isSuperAdmin: boolean;
  canCreateClient: boolean;
  canDeleteClient: boolean;
  canEditClient: boolean;
  canEditSupportNotes: boolean;
  canManageBilling: boolean;
  canManagePlans: boolean;
  canCreateActivationCode: boolean;
  canRevokeActivationCode: boolean;
  canDeactivateDevice: boolean;
  canViewClients: boolean;
  canViewClientUsers: boolean;
  canManageClientUsers: boolean;
  canResetClientUserPassword: boolean;
};

export function useSaasPermissions(): SaasPermissions {
  const role = useSaasAuthStore((s) => s.admin?.role);

  return useMemo(() => {
    const isSuperAdmin = role === 'SUPER_ADMIN';
    const isBilling = role === 'BILLING';
    const isSupport = role === 'SUPPORT';

    return {
      role,
      isSuperAdmin,
      canCreateClient: isSuperAdmin,
      canDeleteClient: isSuperAdmin,
      canEditClient: isSuperAdmin || isSupport || isBilling,
      canEditSupportNotes: isSuperAdmin || isSupport,
      canManageBilling: isSuperAdmin || isBilling,
      canManagePlans: isSuperAdmin,
      canCreateActivationCode: isSuperAdmin || isBilling,
      canRevokeActivationCode: isSuperAdmin,
      canDeactivateDevice: isSuperAdmin || isSupport || isBilling,
      canViewClients: isSuperAdmin || isSupport || isBilling,
      canViewClientUsers: isSuperAdmin || isSupport,
      canManageClientUsers: isSuperAdmin,
      canResetClientUserPassword: isSuperAdmin || isSupport,
    };
  }, [role]);
}
