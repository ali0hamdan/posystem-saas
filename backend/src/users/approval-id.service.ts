import { randomInt } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser } from '../auth/types/safe-user.type';

const MAX_ATTEMPTS = 25;
const FALLBACK_PREFIX = 'MANAGER';

export const REFUND_APPROVAL_ROLES: UserRole[] = [UserRole.GENERAL_MANAGER, UserRole.CO_MANAGER];

export function normalizeNameForApprovalCode(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return normalized || FALLBACK_PREFIX;
}

@Injectable()
export class ApprovalIdService {
  constructor(private readonly prisma: PrismaService) {}

  formatCode(namePrefix: string, digits: number): string {
    return `${namePrefix}@${String(digits).padStart(5, '0')}`;
  }

  async generateApprovalIdCode(clientId: string, name: string): Promise<string> {
    const prefix = normalizeNameForApprovalCode(name);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const digits = randomInt(0, 100_000);
      const code = this.formatCode(prefix, digits);
      const exists = await this.prisma.user.findFirst({
        where: { clientId, approvalIdCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new BadRequestException({
      message: 'Could not generate a unique Approval ID. Please try again.',
      code: 'APPROVAL_ID_GENERATION_FAILED',
    });
  }

  async lookupApprovalId(clientId: string, codeRaw: string) {
    const code = codeRaw.trim().toUpperCase();
    if (!code) {
      throw new NotFoundException({
        message: 'Invalid manager approval ID.',
        code: 'INVALID_APPROVAL_ID',
      });
    }

    const user = await this.prisma.user.findFirst({
      where: { clientId, approvalIdCode: code },
      select: { id: true, name: true, role: true, approvalIdCode: true, isActive: true },
    });

    if (!user?.approvalIdCode || !user.isActive || !REFUND_APPROVAL_ROLES.includes(user.role)) {
      throw new NotFoundException({
        message: 'Invalid manager approval ID.',
        code: 'INVALID_APPROVAL_ID',
      });
    }

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      approvalIdCode: user.approvalIdCode,
      active: true as const,
    };
  }

  async validateApproverForRefund(clientId: string, codeRaw: string | undefined) {
    const code = codeRaw?.trim().toUpperCase() ?? '';
    if (!code) {
      throw new BadRequestException({
        message: 'Approval ID is required.',
        code: 'APPROVAL_ID_REQUIRED',
      });
    }

    const user = await this.prisma.user.findFirst({
      where: { clientId, approvalIdCode: code },
      select: { id: true, name: true, role: true, approvalIdCode: true, isActive: true },
    });

    if (!user?.approvalIdCode) {
      throw new BadRequestException({
        message: 'Invalid manager approval ID.',
        code: 'INVALID_APPROVAL_ID',
      });
    }

    if (!user.isActive) {
      throw new BadRequestException({
        message: 'This manager is inactive.',
        code: 'APPROVAL_MANAGER_INACTIVE',
      });
    }

    if (!REFUND_APPROVAL_ROLES.includes(user.role)) {
      throw new BadRequestException({
        message: 'This approval ID is not authorized for refunds.',
        code: 'APPROVAL_ID_NOT_AUTHORIZED',
      });
    }

    return user;
  }

  async regenerateApprovalId(actor: SafeUser, userId: string) {
    if (actor.role !== UserRole.OWNER) {
      throw new ForbiddenException({
        message: 'Only the owner can regenerate an Approval ID',
        code: 'REGENERATE_APPROVAL_ID_FORBIDDEN',
      });
    }

    const target = await this.prisma.user.findFirst({
      where: { id: userId, clientId: actor.clientId },
    });
    if (!target) {
      throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }
    if (!REFUND_APPROVAL_ROLES.includes(target.role)) {
      throw new BadRequestException({
        message: 'This user is not a general manager or co-manager',
        code: 'NOT_APPROVAL_ROLE',
      });
    }

    const code = await this.generateApprovalIdCode(actor.clientId, target.name);
    return this.prisma.user.update({
      where: { id: userId },
      data: { approvalIdCode: code },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        approvalIdCode: true,
        isActive: true,
      },
    });
  }
}
