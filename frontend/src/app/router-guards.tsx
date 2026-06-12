import type { ReactNode } from 'react';
import { BusinessTypeGuard } from '@/components/auth/BusinessTypeGuard';

export function RetailExclusive({ children }: { children: ReactNode }) {
  return <BusinessTypeGuard mode="retail-exclusive">{children}</BusinessTypeGuard>;
}

export function FnbOnly({ children }: { children: ReactNode }) {
  return <BusinessTypeGuard mode="fnb">{children}</BusinessTypeGuard>;
}

export function WholesaleOnly({ children }: { children: ReactNode }) {
  return <BusinessTypeGuard mode="wholesale">{children}</BusinessTypeGuard>;
}
