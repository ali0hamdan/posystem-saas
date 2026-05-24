import { User } from '@prisma/client';
import { SafeUser } from '../types/safe-user.type';

export function sanitizeUser(user: User): SafeUser {
  const { passwordHash: _removed, ...rest } = user;
  return rest;
}
