import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SafeUser } from '../auth/types/safe-user.type';

/** Standard `where` fragment for a single-tenant Prisma model. */
export function whereForClient(clientId: string): { clientId: string } {
  return { clientId };
}

export function assertClientMatch(user: SafeUser, resourceClientId: string): void {
  if (user.clientId !== resourceClientId) {
    throw new ForbiddenException({
      message: 'You do not have access to this resource',
      code: 'TENANT_FORBIDDEN',
    });
  }
}

/**
 * Use when an entity id was loaded without tenant filter (e.g. legacy path).
 * Prefer querying with `{ id, clientId: user.clientId }` instead.
 */
export async function assertEntityClient<T extends { clientId: string }>(
  user: SafeUser,
  row: T | null,
): Promise<T> {
  if (!row) {
    throw new NotFoundException({ message: 'Resource not found', code: 'NOT_FOUND' });
  }
  assertClientMatch(user, row.clientId);
  return row;
}

export type ClientScoped = { clientId: string };

export function mergeWhereClient<T extends object>(
  clientId: string,
  where: T,
): T & { clientId: string } {
  return { ...where, clientId };
}

export type JsonAudit = Prisma.InputJsonValue;
