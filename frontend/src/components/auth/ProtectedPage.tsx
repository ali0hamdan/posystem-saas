import type { ReactNode } from 'react';
import { FnbOnly, RetailExclusive, WholesaleOnly } from '@/app/router-guards';
import { PermissionRoute } from '@/components/auth/PermissionRoute';

type BusinessGuard = 'retail' | 'fnb' | 'wholesale';

type ProtectedPageProps = {
  children: ReactNode;
  /** Single permission or any-of list */
  permission: string | string[];
  /** Optional business-type guard */
  business?: BusinessGuard;
};

/**
 * Standard protected page shell: optional business-type guard + permission check.
 * Backend guards remain the source of truth; this is UX + direct-route safety.
 */
export function ProtectedPage({ children, permission, business }: ProtectedPageProps) {
  let content = <PermissionRoute require={permission}>{children}</PermissionRoute>;

  if (business === 'retail') {
    content = <RetailExclusive>{content}</RetailExclusive>;
  } else if (business === 'fnb') {
    content = <FnbOnly>{content}</FnbOnly>;
  } else if (business === 'wholesale') {
    content = <WholesaleOnly>{content}</WholesaleOnly>;
  }

  return content;
}
