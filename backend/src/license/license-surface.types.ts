import type { LicensePlan } from '@prisma/client';

export type LicenseSurfaceStatus =
  | 'ACTIVE'
  | 'GRACE'
  | 'LOCKED'
  | 'SUSPENDED'
  | 'CLIENT_INACTIVE'
  | 'INVALID_TOKEN'
  | 'NOT_REGISTERED'
  | 'TOKEN_MISMATCH'
  | 'BYPASS';

export type LicenseSurfacePayload = {
  status: LicenseSurfaceStatus;
  allowsPosAccess: boolean;
  warning: boolean;
  plan: LicensePlan | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  graceRemaining: number;
  /** Null = unlimited (Desktop Lifetime plans). */
  maxUsers: number | null;
  maxBranches: number | null;
  maxDevices: number | null;
  enabledFeatures: Record<string, boolean>;
};
