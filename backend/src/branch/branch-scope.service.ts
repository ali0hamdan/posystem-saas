import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser } from '../auth/types/safe-user.type';
import { MAIN_BRANCH_CODE } from './branch.constants';

@Injectable()
export class BranchScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves the preferred default branch id for this tenant (code MAIN). */
  async resolveDefaultBranchId(clientId: string): Promise<string> {
    const b = await this.prisma.branch.findFirst({
      where: { clientId, code: MAIN_BRANCH_CODE, isActive: true },
      select: { id: true },
    });
    if (!b) {
      throw new NotFoundException({
        message: 'Default branch (MAIN) not found for this store',
        code: 'MAIN_BRANCH_MISSING',
      });
    }
    return b.id;
  }

  /**
   * Resolves the branch context for the current request.
   * - OWNER: may omit header → defaults to MAIN branch for their tenant; may pass any active branch they own.
   * - ADMIN: must pass a branch they are assigned to.
   * - CASHIER: must belong to exactly one branch; header optional (defaults to that branch).
   */
  async resolveBranchId(user: SafeUser, headerBranchId?: string | string[]): Promise<string> {
    const raw = Array.isArray(headerBranchId) ? headerBranchId[0] : headerBranchId;
    const requested = typeof raw === 'string' ? raw.trim() : '';

    if (user.role === UserRole.OWNER) {
      const id = requested || (await this.resolveDefaultBranchId(user.clientId));
      await this.assertBranchActive(id, user.clientId);
      return id;
    }

    const links = await this.prisma.userBranch.findMany({
      where: { userId: user.id },
      select: { branchId: true },
    });
    const allowed = new Set(links.map((l) => l.branchId));

    if (user.role === UserRole.CASHIER) {
      if (links.length !== 1) {
        throw new ForbiddenException({
          message: 'Cashier accounts must be assigned to exactly one branch',
          code: 'BRANCH_ASSIGNMENT_INVALID',
        });
      }
      const only = links[0]!.branchId;
      if (requested && requested !== only) {
        throw new ForbiddenException({
          message: 'Cashiers may only use their assigned branch',
          code: 'BRANCH_ACCESS_DENIED',
        });
      }
      const id = requested || only;
      if (!allowed.has(id)) {
        throw new ForbiddenException({
          message: 'You do not have access to this branch',
          code: 'BRANCH_ACCESS_DENIED',
        });
      }
      await this.assertBranchActive(id, user.clientId);
      return id;
    }

    // ADMIN
    if (!requested) {
      throw new BadRequestException({
        message: 'X-Branch-Id header is required',
        code: 'BRANCH_REQUIRED',
      });
    }
    if (!allowed.has(requested)) {
      throw new ForbiddenException({
        message: 'You do not have access to this branch',
        code: 'BRANCH_ACCESS_DENIED',
      });
    }
    await this.assertBranchActive(requested, user.clientId);
    return requested;
  }

  /**
   * Like `resolveBranchId`, but allows OWNER to pass an explicit `branchId` query param
   * (e.g. reports UI) which overrides the header/default branch when valid.
   */
  async resolveBranchIdForReport(
    user: SafeUser,
    headerBranchId?: string | string[],
    queryBranchId?: string,
  ): Promise<string> {
    const q = typeof queryBranchId === 'string' ? queryBranchId.trim() : '';
    if (user.role === UserRole.OWNER && q) {
      await this.assertBranchActive(q, user.clientId);
      return q;
    }
    return this.resolveBranchId(user, headerBranchId);
  }

  /** Branches returned to the client (login / me). */
  async listBranchesForUser(user: SafeUser) {
    if (user.role === UserRole.OWNER) {
      return this.prisma.branch.findMany({
        where: { clientId: user.clientId, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, isActive: true },
      });
    }
    const links = await this.prisma.userBranch.findMany({
      where: { userId: user.id },
      include: {
        branch: {
          select: { id: true, name: true, code: true, isActive: true, clientId: true },
        },
      },
    });
    return links
      .map((l) => l.branch)
      .filter((b) => b.isActive && b.clientId === user.clientId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private async assertBranchActive(branchId: string, clientId: string): Promise<void> {
    const b = await this.prisma.branch.findFirst({
      where: { id: branchId, isActive: true, clientId },
      select: { id: true },
    });
    if (!b) {
      throw new NotFoundException({
        message: 'Branch not found or inactive',
        code: 'BRANCH_NOT_FOUND',
      });
    }
  }
}
