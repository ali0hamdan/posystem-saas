import { UserRole } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  username: string;
  role: UserRole;
  clientId: string;
  /** Present on newly issued tokens; absent on legacy tokens (still accepted if not saas-admin). */
  typ?: 'store-user';
};
