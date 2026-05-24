import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function redactAuditValue(value: unknown): unknown {
  if (value === null || typeof value === 'undefined') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactAuditValue);
  }
  if (typeof value !== 'object') {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/password|token|secret|hash|authorization|cvv|pan|cardnumber|apikey|privatekey|accesskey|refreshtoken|bearertoken|keypair|credential|passphrase/i.test(k)) {
      out[k] = '[REDACTED]';
    } else if (v !== null && typeof v === 'object') {
      out[k] = redactAuditValue(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId: string | null;
    /** When omitted and `userId` is set, clientId is resolved from the store user row. */
    clientId?: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    oldValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
  }): Promise<void> {
    let clientId: string | null = params.clientId ?? null;
    if (clientId === null && params.userId) {
      const u = await this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { clientId: true },
      });
      clientId = u?.clientId ?? null;
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          clientId,
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          oldValue:
            params.oldValue !== undefined
              ? (redactAuditValue(params.oldValue) as Prisma.InputJsonValue)
              : undefined,
          newValue:
            params.newValue !== undefined
              ? (redactAuditValue(params.newValue) as Prisma.InputJsonValue)
              : undefined,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Audit log failed (${params.action}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
