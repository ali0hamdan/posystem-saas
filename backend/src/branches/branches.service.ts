import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BranchScopeService } from '../branch/branch-scope.service';
import { PlanLimitService } from '../common/services/plan-limit.service';
import { SafeUser } from '../auth/types/safe-user.type';
import type { LicenseRequestContext } from '../license/license-context.decorator';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

import { LicenseService } from '../license/license.service';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly licenseService: LicenseService,
    private readonly planLimit: PlanLimitService,
  ) {}

  async listForUser(user: SafeUser) {
    return this.branchScope.listBranchesForUser(user);
  }

  async findOne(id: string, user: SafeUser) {
    await this.assertBranchReadable(id, user);
    const b = await this.prisma.branch.findFirst({
      where: { id, clientId: user.clientId },
    });
    if (!b) {
      throw new NotFoundException({ message: 'Branch not found', code: 'BRANCH_NOT_FOUND' });
    }
    return b;
  }

  async create(dto: CreateBranchDto, user: SafeUser, license: LicenseRequestContext | null) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException({
        message: 'Only owners can create branches',
        code: 'BRANCH_CREATE_DENIED',
      });
    }
    await this.planLimit.assertCanCreateBranch(user.clientId);
    await this.licenseService.assertBranchCapacity(license?.licenseId ?? null);
    const code = dto.code.trim().toUpperCase();
    try {
      return await this.prisma.branch.create({
        data: {
          clientId: user.clientId,
          name: dto.name.trim(),
          code,
          address: dto.address?.trim() || null,
          phone: dto.phone?.trim() || null,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (err: unknown) {
      this.throwIfUniqueCode(err);
      throw err;
    }
  }

  async update(id: string, dto: UpdateBranchDto, user: SafeUser) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException({
        message: 'Only owners can update branches',
        code: 'BRANCH_UPDATE_DENIED',
      });
    }
    const existing = await this.prisma.branch.findFirst({
      where: { id, clientId: user.clientId },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Branch not found', code: 'BRANCH_NOT_FOUND' });
    }
    try {
      return await this.prisma.branch.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
          ...(dto.address !== undefined ? { address: dto.address.trim() || null } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    } catch (err: unknown) {
      this.throwIfUniqueCode(err);
      throw err;
    }
  }

  private async assertBranchReadable(branchId: string, user: SafeUser): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, clientId: user.clientId, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException({
        message: 'Branch not found or inactive',
        code: 'BRANCH_NOT_FOUND',
      });
    }

    if (user.role === UserRole.OWNER) {
      return;
    }

    const link = await this.prisma.userBranch.findFirst({
      where: { userId: user.id, branchId },
      select: { userId: true, branchId: true },
    });
    if (!link) {
      throw new ForbiddenException({
        message: 'You do not have access to this branch',
        code: 'BRANCH_ACCESS_DENIED',
      });
    }
  }

  private throwIfUniqueCode(err: unknown): void {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      throw new ConflictException({
        message: 'Branch code must be unique within your store',
        code: 'BRANCH_CODE_CONFLICT',
      });
    }
  }
}
