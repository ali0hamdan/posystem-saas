import { SubscriptionStatus, User } from '@prisma/client';
import { SafeUser } from '../types/safe-user.type';
import { maskNfcCardUid } from '../../common/utils/nfc-approval.util';

export function sanitizeUser(
  user: User,
  extra?: { subscriptionStatus?: SubscriptionStatus | null },
): SafeUser {
  const {
    passwordHash: _removed,
    refreshTokenHash: _removed2,
    approvalPinHash: _removedPin,
    nfcCardUid,
    ...rest
  } = user;
  return {
    ...rest,
    nfcCardRegistered: Boolean(nfcCardUid),
    nfcCardMasked: nfcCardUid ? maskNfcCardUid(nfcCardUid) : null,
    subscriptionStatus: extra?.subscriptionStatus ?? null,
  };
}
