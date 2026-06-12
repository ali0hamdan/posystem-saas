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
const FALLBACK_PREFIX = 'SALESMAN';

export function normalizeSalesmanNameForCode(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return normalized || FALLBACK_PREFIX;
}

@Injectable()
export class SalesmanIdService {
  constructor(private readonly prisma: PrismaService) {}

  formatCode(namePrefix: string, digits: number): string {
    return `${namePrefix}-${String(digits).padStart(4, '0')}`;
  }

  async generateSalesmanIdCode(clientId: string, name: string): Promise<string> {
    const prefix = normalizeSalesmanNameForCode(name);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const digits = randomInt(0, 10_000);
      const code = this.formatCode(prefix, digits);
      const exists = await this.prisma.user.findFirst({
        where: { clientId, salesmanIdCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new BadRequestException({
      message: 'Could not generate a unique Salesman ID. Please try again.',
      code: 'SALESMAN_ID_GENERATION_FAILED',
    });
  }

  async ensureSalesmanHasCode(user: Pick<SafeUser, 'id' | 'clientId' | 'name' | 'role' | 'salesmanIdCode'>): Promise<string | null> {
    if (user.role !== UserRole.SALESMAN) return null;
    if (user.salesmanIdCode) return user.salesmanIdCode;
    const code = await this.generateSalesmanIdCode(user.clientId, user.name);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { salesmanIdCode: code },
    });
    return code;
  }

  async lookupActiveSalesman(clientId: string, codeRaw: string) {
    const code = codeRaw.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException({
        message: 'Salesman ID is required.',
        code: 'SALESMAN_ID_REQUIRED',
      });
    }
    const user = await this.prisma.user.findFirst({
      where: {
        clientId,
        salesmanIdCode: code,
        role: UserRole.SALESMAN,
        isActive: true,
      },
      select: { id: true, name: true, salesmanIdCode: true, isActive: true },
    });
    if (!user?.salesmanIdCode) {
      throw new NotFoundException({
        message: 'Salesman ID not found or inactive.',
        code: 'INVALID_SALESMAN_ID',
      });
    }
    return user;
  }

  async searchActiveSalesmen(clientId: string, search?: string) {
    const q = search?.trim();
    return this.prisma.user.findMany({
      where: {
        clientId,
        role: UserRole.SALESMAN,
        isActive: true,
        salesmanIdCode: { not: null },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { salesmanIdCode: { contains: q.toUpperCase(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, salesmanIdCode: true, isActive: true },
      orderBy: { name: 'asc' },
      take: 50,
    });
  }

  async regenerateSalesmanId(actor: SafeUser, userId: string) {
    if (
      actor.role !== UserRole.OWNER &&
      actor.role !== UserRole.GENERAL_MANAGER &&
      actor.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException({
        message: 'Only the owner or general manager can regenerate a Salesman ID',
        code: 'REGENERATE_SALESMAN_ID_FORBIDDEN',
      });
    }
    const target = await this.prisma.user.findFirst({
      where: { id: userId, clientId: actor.clientId },
    });
    if (!target) {
      throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }
    if (target.role !== UserRole.SALESMAN) {
      throw new BadRequestException({
        message: 'This user is not a salesman',
        code: 'NOT_SALESMAN',
      });
    }
    const code = await this.generateSalesmanIdCode(actor.clientId, target.name);
    return this.prisma.user.update({
      where: { id: userId },
      data: { salesmanIdCode: code },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        salesmanIdCode: true,
        isActive: true,
      },
    });
  }
}
