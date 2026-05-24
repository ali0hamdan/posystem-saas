import type { SaasAdminRole } from '@prisma/client';

export type SaasJwtPayload = {
  sub: string;
  typ: 'saas-admin';
  email: string;
  /** Omitted on legacy tokens; treat as matching DB role for validation. */
  role?: SaasAdminRole;
};
