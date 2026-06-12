import { SubscriptionStatus, User } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash' | 'refreshTokenHash' | 'approvalPinHash' | 'nfcCardUid'> & {
  /** Latest subscription status for the user's tenant. `null` when no subscription exists yet. */
  subscriptionStatus?: SubscriptionStatus | null;
  nfcCardRegistered?: boolean;
  nfcCardMasked?: string | null;
};
