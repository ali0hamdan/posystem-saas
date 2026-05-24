import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivationCodeStatus,
  ClientStatus,
  Prisma,
  SaasAdminRole,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import { hash } from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { MAIN_BRANCH_CODE } from '../branch/branch.constants';
import type { SaasAdminSafe } from './strategies/saas-jwt.strategy';
import type { CreateSaasClientDto } from './dto/create-saas-client.dto';
import type { ListSaasClientsQueryDto } from './dto/list-saas-clients.query.dto';
import type { PatchSaasClientDto } from './dto/patch-saas-client.dto';
import type { PatchSaasClientStatusDto } from './dto/patch-saas-client-status.dto';
import type { CreateClientActivationCodeDto } from './dto/create-client-activation-code.dto';
import type { ListClientActivationCodesQueryDto } from './dto/list-client-activation-codes.query.dto';
import type { RenewClientSubscriptionDto } from './dto/renew-client-subscription.dto';
import type { ChangeClientPlanDto } from './dto/change-client-plan.dto';
import type { ListClientUsersQueryDto } from './dto/list-client-users.query.dto';
import type { CreateClientUserDto } from './dto/create-client-user.dto';
import type { PatchClientUserDto } from './dto/patch-client-user.dto';
import type { PatchClientUserPasswordDto } from './dto/patch-client-user-password.dto';
import type { PatchClientUserStatusDto } from './dto/patch-client-user-status.dto';

const BCRYPT_ROUNDS = 12;

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function definedKeys<T extends object>(obj: T): (keyof T)[] {
  return (Object.keys(obj) as (keyof T)[]).filter((k) => obj[k] !== undefined);
}

@Injectable()
export class SaasClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private async resolveUniqueSlug(
    db: Pick<PrismaService, 'client'>,
    baseInput: string,
  ): Promise<string> {
    const base = slugify(baseInput) || 'store';
    let candidate = base;
    for (let i = 0; i < 50; i++) {
      const clash = await db.client.findFirst({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!clash) {
        return candidate;
      }
      candidate = `${base}-${randomBytes(2).toString('hex')}`;
    }
    throw new ConflictException({ message: 'Could not allocate unique slug', code: 'CLIENT_SLUG_EXHAUSTED' });
  }

  private assertCanListDeleted(admin: SaasAdminSafe, includeDeleted?: boolean): void {
    if (includeDeleted && admin.role !== SaasAdminRole.SUPER_ADMIN) {
      throw new ForbiddenException({
        message: 'Only SUPER_ADMIN can list deleted clients',
        code: 'SAAS_CLIENTS_INCLUDE_DELETED_DENIED',
      });
    }
  }

  private assertPatchBodyForRole(admin: SaasAdminSafe, dto: PatchSaasClientDto): void {
    const keys = definedKeys(dto);
    if (admin.role === SaasAdminRole.SUPER_ADMIN) {
      return;
    }
    if (admin.role === SaasAdminRole.SUPPORT) {
      const allowed: (keyof PatchSaasClientDto)[] = ['supportNotes'];
      const bad = keys.filter((k) => !allowed.includes(k));
      if (bad.length) {
        throw new ForbiddenException({
          message: 'SUPPORT may only update supportNotes',
          code: 'SAAS_CLIENTS_PATCH_DENIED',
        });
      }
      return;
    }
    if (admin.role === SaasAdminRole.BILLING) {
      const allowed: (keyof PatchSaasClientDto)[] = ['subscription'];
      const bad = keys.filter((k) => !allowed.includes(k));
      if (bad.length) {
        throw new ForbiddenException({
          message: 'BILLING may only update subscription',
          code: 'SAAS_CLIENTS_PATCH_DENIED',
        });
      }
    }
  }

  async list(admin: SaasAdminSafe, query: ListSaasClientsQueryDto) {
    this.assertCanListDeleted(admin, query.includeDeleted);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const q = query.q?.trim();
    const showDeleted = admin.role === SaasAdminRole.SUPER_ADMIN && query.includeDeleted;

    const where: Prisma.ClientWhereInput = {
      ...(!showDeleted ? { deletedAt: null } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(q
        ? {
            OR: [
              { businessName: { contains: q, mode: 'insensitive' } },
              { ownerName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q.toLowerCase(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          businessName: true,
          ownerName: true,
          email: true,
          phone: true,
          status: true,
          notes: true,
          supportNotes: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  private async getCurrentSubscription(clientId: string) {
    const active = await this.prisma.subscription.findFirst({
      where: { clientId, status: SubscriptionStatus.ACTIVE },
      orderBy: { expiresAt: 'desc' },
      include: { plan: { select: { id: true, code: true, name: true } } },
    });
    if (active) {
      return active;
    }
    return this.prisma.subscription.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { id: true, code: true, name: true } } },
    });
  }

  async findOne(admin: SaasAdminSafe, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        slug: true,
        businessName: true,
        ownerName: true,
        email: true,
        phone: true,
        status: true,
        notes: true,
        supportNotes: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!client) {
      throw new NotFoundException({ message: 'Client not found', code: 'SAAS_CLIENT_NOT_FOUND' });
    }

    const [
      currentSubscription,
      usersCount,
      branchesCount,
      devicesCount,
      activationCodesCount,
      deviceAgg,
    ] = await Promise.all([
      this.getCurrentSubscription(id),
      this.prisma.user.count({ where: { clientId: id } }),
      this.prisma.branch.count({ where: { clientId: id } }),
      this.prisma.device.count({ where: { clientId: id } }),
      this.prisma.activationCode.count({ where: { clientId: id } }),
      this.prisma.device.aggregate({
        where: { clientId: id },
        _max: { lastSeenAt: true },
      }),
    ]);

    return {
      client,
      currentSubscription: currentSubscription
        ? {
            id: currentSubscription.id,
            status: currentSubscription.status,
            startsAt: currentSubscription.startsAt.toISOString(),
            expiresAt: currentSubscription.expiresAt?.toISOString() ?? null,
            maxUsers: currentSubscription.maxUsers,
            maxBranches: currentSubscription.maxBranches,
            maxDevices: currentSubscription.maxDevices,
            graceDays: currentSubscription.graceDays,
            planId: currentSubscription.planId,
          }
        : null,
      plan: currentSubscription?.plan ?? null,
      usersCount,
      branchesCount,
      devicesCount,
      activationCodesCount,
      licenseExpiresAt: currentSubscription?.expiresAt?.toISOString() ?? null,
      lastDeviceSyncAt: deviceAgg._max.lastSeenAt?.toISOString() ?? null,
      status: client.status,
    };
  }

  private async expireStaleActivationCodes(): Promise<void> {
    const now = new Date();
    await this.prisma.activationCode.updateMany({
      where: {
        status: ActivationCodeStatus.UNUSED,
        validUntil: { lt: now },
      },
      data: { status: ActivationCodeStatus.EXPIRED },
    });
  }

  async listActivationCodes(
    _admin: SaasAdminSafe,
    clientId: string,
    query: ListClientActivationCodesQueryDto,
  ) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException({ message: 'Client not found', code: 'SAAS_CLIENT_NOT_FOUND' });
    }
    await this.expireStaleActivationCodes();
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const where: Prisma.ActivationCodeWhereInput = {
      clientId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.activationCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          validUntil: true,
          usedCount: true,
          maxUses: true,
          label: true,
          maxDevices: true,
          maxBranches: true,
          graceDays: true,
          termDays: true,
          createdAt: true,
          revokedAt: true,
          plan: { select: { code: true, name: true } },
        },
      }),
      this.prisma.activationCode.count({ where }),
    ]);
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async createActivationCodeForClient(
    admin: SaasAdminSafe,
    clientId: string,
    dto: CreateClientActivationCodeDto,
  ) {
    if (admin.role !== SaasAdminRole.SUPER_ADMIN && admin.role !== SaasAdminRole.BILLING) {
      throw new ForbiddenException({
        message: 'Only SUPER_ADMIN or BILLING can create activation codes',
        code: 'SAAS_ACTIVATION_CODE_CREATE_DENIED',
      });
    }
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException({ message: 'Client not found', code: 'SAAS_CLIENT_NOT_FOUND' });
    }
    const planRow = await this.prisma.plan.findUnique({ where: { code: dto.plan } });
    if (!planRow) {
      throw new NotFoundException({ message: 'Plan not found', code: 'PLAN_NOT_FOUND' });
    }
    await this.expireStaleActivationCodes();

    const plain = `POS-${randomBytes(24).toString('hex')}`;
    const lookupHash = sha256Hex(plain.toLowerCase());
    const validUntil = new Date(Date.now() + dto.validDays * 86_400_000);

    const row = await this.prisma.activationCode.create({
      data: {
        clientId,
        planId: planRow.id,
        lookupHash,
        maxBranches: dto.maxBranches,
        maxDevices: dto.maxDevices,
        graceDays: dto.graceDays,
        termDays: dto.termDays,
        maxUses: dto.maxUses,
        validUntil,
        status: ActivationCodeStatus.UNUSED,
        label: dto.label?.trim() || null,
        createdByUserId: null,
        createdBySaaSAdminId: admin.id,
      },
    });

    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.clients.activation_code.create',
      entity: 'ActivationCode',
      entityId: row.id,
      newValue: {
        clientId,
        plan: dto.plan,
        label: row.label,
        saasAdminId: admin.id,
      },
    });

    return {
      id: row.id,
      activationCode: plain,
      validUntil: row.validUntil.toISOString(),
      status: row.status,
      maxUses: row.maxUses,
    };
  }

  async revokeActivationCode(admin: SaasAdminSafe, codeId: string) {
    if (admin.role !== SaasAdminRole.SUPER_ADMIN) {
      throw new ForbiddenException({
        message: 'Only SUPER_ADMIN can revoke activation codes',
        code: 'SAAS_ACTIVATION_CODE_REVOKE_DENIED',
      });
    }
    await this.expireStaleActivationCodes();

    const code = await this.prisma.activationCode.findUnique({
      where: { id: codeId },
    });
    if (!code) {
      throw new NotFoundException({
        message: 'Activation code not found',
        code: 'SAAS_ACTIVATION_CODE_NOT_FOUND',
      });
    }
    if (!code.clientId) {
      throw new BadRequestException({
        message: 'This activation code cannot be revoked via SaaS (not linked to a client)',
        code: 'SAAS_ACTIVATION_CODE_NOT_CLIENT_BOUND',
      });
    }
    if (code.status === ActivationCodeStatus.REVOKED) {
      throw new BadRequestException({
        message: 'Activation code is already revoked',
        code: 'SAAS_ACTIVATION_CODE_ALREADY_REVOKED',
      });
    }
    if (code.status === ActivationCodeStatus.USED) {
      throw new BadRequestException({
        message: 'Activation code is already fully used',
        code: 'SAAS_ACTIVATION_CODE_ALREADY_USED',
      });
    }
    if (code.status === ActivationCodeStatus.EXPIRED) {
      throw new BadRequestException({
        message: 'Activation code has expired',
        code: 'SAAS_ACTIVATION_CODE_EXPIRED',
      });
    }

    const now = new Date();
    const updated = await this.prisma.activationCode.update({
      where: { id: codeId },
      data: {
        status: ActivationCodeStatus.REVOKED,
        revokedAt: now,
        revokedBySaaSAdminId: admin.id,
      },
    });

    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.activation_code.revoke',
      entity: 'ActivationCode',
      entityId: codeId,
      oldValue: { status: code.status },
      newValue: { status: updated.status, saasAdminId: admin.id, clientId: code.clientId },
    });

    return {
      id: updated.id,
      status: updated.status,
      revokedAt: updated.revokedAt?.toISOString() ?? null,
    };
  }

  private async getPrimarySubscriptionForClient(clientId: string) {
    const active = await this.prisma.subscription.findFirst({
      where: { clientId, status: SubscriptionStatus.ACTIVE },
      orderBy: { expiresAt: 'desc' },
      include: { plan: true },
    });
    if (active) {
      return active;
    }
    return this.prisma.subscription.findFirst({
      where: { clientId },
      orderBy: { updatedAt: 'desc' },
      include: { plan: true },
    });
  }

  private assertBillingOrSuper(admin: SaasAdminSafe): void {
    if (admin.role !== SaasAdminRole.SUPER_ADMIN && admin.role !== SaasAdminRole.BILLING) {
      throw new ForbiddenException({
        message: 'Only SUPER_ADMIN or BILLING can perform this action',
        code: 'SAAS_SUBSCRIPTION_ACTION_DENIED',
      });
    }
  }

  private assertCanViewClientUsers(admin: SaasAdminSafe): void {
    if (admin.role === SaasAdminRole.SUPER_ADMIN || admin.role === SaasAdminRole.SUPPORT) {
      return;
    }
    throw new ForbiddenException({
      message: 'Only SUPER_ADMIN or SUPPORT can view client users',
      code: 'SAAS_CLIENT_USERS_VIEW_DENIED',
    });
  }

  private assertCanManageClientUsers(admin: SaasAdminSafe): void {
    if (admin.role === SaasAdminRole.SUPER_ADMIN) {
      return;
    }
    throw new ForbiddenException({
      message: 'Only SUPER_ADMIN can manage client users',
      code: 'SAAS_CLIENT_USERS_MANAGE_DENIED',
    });
  }

  private assertCanResetClientUserPassword(admin: SaasAdminSafe): void {
    if (admin.role === SaasAdminRole.SUPER_ADMIN || admin.role === SaasAdminRole.SUPPORT) {
      return;
    }
    throw new ForbiddenException({
      message: 'Only SUPER_ADMIN or SUPPORT can reset user passwords',
      code: 'SAAS_CLIENT_USERS_PASSWORD_DENIED',
    });
  }

  private async assertClientExists(clientId: string): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException({ message: 'Client not found', code: 'SAAS_CLIENT_NOT_FOUND' });
    }
  }

  private async assertBranchBelongsToClient(
    tx: Prisma.TransactionClient,
    clientId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await tx.branch.findFirst({
      where: { id: branchId, clientId, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      throw new BadRequestException({
        message: 'branchId does not belong to this client or is inactive',
        code: 'SAAS_CLIENT_USER_BRANCH_INVALID',
      });
    }
  }

  private async assertClientUserWithinSubscriptionLimit(
    tx: Prisma.TransactionClient,
    clientId: string,
    nextActiveCountDelta: 0 | 1,
  ): Promise<void> {
    if (nextActiveCountDelta === 0) return;
    const sub = await this.getPrimarySubscriptionForClient(clientId);
    if (!sub) return;
    const activeUsers = await tx.user.count({ where: { clientId, isActive: true } });
    if (activeUsers + nextActiveCountDelta > sub.maxUsers) {
      throw new BadRequestException({
        message: `User limit reached for subscription (${sub.maxUsers})`,
        code: 'SAAS_CLIENT_USER_LIMIT_EXCEEDED',
      });
    }
  }

  private mapClientUserRow(
    row: {
      id: string;
      name: string;
      username: string;
      email: string | null;
      role: UserRole;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      branchLinks: Array<{
        branch: { id: string; name: string };
      }>;
    },
  ) {
    const branch = row.branchLinks[0]?.branch;
    return {
      id: row.id,
      name: row.name,
      username: row.username,
      email: row.email,
      role: row.role,
      branchId: branch?.id ?? null,
      branchName: branch?.name ?? null,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastLoginAt: null as string | null,
    };
  }

  async listClientUsers(admin: SaasAdminSafe, clientId: string, query: ListClientUsersQueryDto) {
    this.assertCanViewClientUsers(admin);
    await this.assertClientExists(clientId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const q = query.q?.trim();

    const where: Prisma.UserWhereInput = {
      clientId,
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { username: { contains: q.toLowerCase(), mode: 'insensitive' } },
              { email: { contains: q.toLowerCase(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          branchLinks: {
            take: 1,
            orderBy: { branch: { name: 'asc' } },
            select: { branch: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    await this.audit.log({
      userId: null,
      clientId,
      action: 'saas.clients.users.list',
      entity: 'User',
      entityId: null,
      newValue: {
        saasAdminId: admin.id,
        page,
        limit,
        includeInactive: query.includeInactive === true,
      },
    });

    return {
      data: data.map((row) => this.mapClientUserRow(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async createClientUser(admin: SaasAdminSafe, clientId: string, dto: CreateClientUserDto) {
    this.assertCanManageClientUsers(admin);
    await this.assertClientExists(clientId);

    const username = dto.username.trim().toLowerCase();
    const email = dto.email?.trim().toLowerCase() || null;
    const name = dto.name.trim();
    const isActive = dto.isActive ?? true;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (dto.branchId) {
          await this.assertBranchBelongsToClient(tx, clientId, dto.branchId);
        }
        if (isActive) {
          await this.assertClientUserWithinSubscriptionLimit(tx, clientId, 1);
        }
        const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
        const user = await tx.user.create({
          data: {
            clientId,
            name,
            username,
            email,
            passwordHash,
            role: dto.role,
            isActive,
          },
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (dto.branchId) {
          await tx.userBranch.create({
            data: { userId: user.id, branchId: dto.branchId },
          });
        }
        const withBranch = await tx.user.findUniqueOrThrow({
          where: { id: user.id },
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            branchLinks: {
              take: 1,
              orderBy: { branch: { name: 'asc' } },
              select: { branch: { select: { id: true, name: true } } },
            },
          },
        });
        return withBranch;
      });

      await this.audit.log({
        userId: null,
        clientId,
        action: 'saas.clients.users.create',
        entity: 'User',
        entityId: created.id,
        newValue: {
          saasAdminId: admin.id,
          role: created.role,
          username: created.username,
          isActive: created.isActive,
          branchId: created.branchLinks[0]?.branch.id ?? null,
        },
      });

      return this.mapClientUserRow(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          message: 'Username or email already exists for this client',
          code: 'SAAS_CLIENT_USER_UNIQUE_VIOLATION',
        });
      }
      throw err;
    }
  }

  async patchClientUser(admin: SaasAdminSafe, clientId: string, userId: string, dto: PatchClientUserDto) {
    this.assertCanManageClientUsers(admin);
    await this.assertClientExists(clientId);

    const keys = definedKeys(dto);
    if (keys.length === 0) {
      throw new BadRequestException({ message: 'No fields to update', code: 'EMPTY_UPDATE' });
    }

    const existing = await this.prisma.user.findFirst({
      where: { id: userId, clientId },
      select: { id: true, isActive: true },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'User not found', code: 'SAAS_CLIENT_USER_NOT_FOUND' });
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (dto.branchId) {
          await this.assertBranchBelongsToClient(tx, clientId, dto.branchId);
        }
        if (dto.isActive === true && existing.isActive === false) {
          await this.assertClientUserWithinSubscriptionLimit(tx, clientId, 1);
        }
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.username !== undefined ? { username: dto.username.trim().toLowerCase() } : {}),
            ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
            ...(dto.role !== undefined ? { role: dto.role } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          },
        });

        if (dto.branchId !== undefined) {
          await tx.userBranch.deleteMany({ where: { userId } });
          await tx.userBranch.create({ data: { userId, branchId: dto.branchId } });
        }

        return tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            branchLinks: {
              take: 1,
              orderBy: { branch: { name: 'asc' } },
              select: { branch: { select: { id: true, name: true } } },
            },
          },
        });
      });

      await this.audit.log({
        userId: null,
        clientId,
        action: 'saas.clients.users.update',
        entity: 'User',
        entityId: userId,
        newValue: { saasAdminId: admin.id, fields: keys },
      });

      return this.mapClientUserRow(updated);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          message: 'Username or email already exists for this client',
          code: 'SAAS_CLIENT_USER_UNIQUE_VIOLATION',
        });
      }
      throw err;
    }
  }

  async patchClientUserPassword(
    admin: SaasAdminSafe,
    clientId: string,
    userId: string,
    dto: PatchClientUserPasswordDto,
  ) {
    this.assertCanResetClientUserPassword(admin);
    await this.assertClientExists(clientId);
    const existing = await this.prisma.user.findFirst({
      where: { id: userId, clientId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'User not found', code: 'SAAS_CLIENT_USER_NOT_FOUND' });
    }
    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.audit.log({
      userId: null,
      clientId,
      action: 'saas.clients.users.password_reset',
      entity: 'User',
      entityId: userId,
      newValue: { saasAdminId: admin.id },
    });
    return { id: userId, passwordUpdated: true };
  }

  async patchClientUserStatus(
    admin: SaasAdminSafe,
    clientId: string,
    userId: string,
    dto: PatchClientUserStatusDto,
  ) {
    this.assertCanManageClientUsers(admin);
    await this.assertClientExists(clientId);
    const existing = await this.prisma.user.findFirst({
      where: { id: userId, clientId },
      select: { id: true, isActive: true },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'User not found', code: 'SAAS_CLIENT_USER_NOT_FOUND' });
    }
    await this.prisma.$transaction(async (tx) => {
      if (dto.isActive && !existing.isActive) {
        await this.assertClientUserWithinSubscriptionLimit(tx, clientId, 1);
      }
      await tx.user.update({
        where: { id: userId },
        data: { isActive: dto.isActive },
      });
    });
    await this.audit.log({
      userId: null,
      clientId,
      action: 'saas.clients.users.status',
      entity: 'User',
      entityId: userId,
      oldValue: { isActive: existing.isActive },
      newValue: { isActive: dto.isActive, saasAdminId: admin.id },
    });
    return { id: userId, isActive: dto.isActive };
  }

  async deleteClientUser(admin: SaasAdminSafe, clientId: string, userId: string) {
    this.assertCanManageClientUsers(admin);
    await this.assertClientExists(clientId);
    const existing = await this.prisma.user.findFirst({
      where: { id: userId, clientId },
      select: { id: true, isActive: true },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'User not found', code: 'SAAS_CLIENT_USER_NOT_FOUND' });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    await this.audit.log({
      userId: null,
      clientId,
      action: 'saas.clients.users.deactivate',
      entity: 'User',
      entityId: userId,
      oldValue: { isActive: existing.isActive },
      newValue: { isActive: false, saasAdminId: admin.id },
    });
    return { id: userId, deleted: true };
  }

  async listClientPaymentRecords(_admin: SaasAdminSafe, clientId: string) {
    await this.assertClientExists(clientId);
    const rows = await this.prisma.paymentRecord.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        billingCycle: true,
        paymentProvider: true,
        paidAt: true,
        createdAt: true,
        plan: { select: { code: true, name: true } },
      },
    });
    return rows.map((r) => ({
      ...r,
      amount: r.amount.toString(),
    }));
  }

  async getClientSubscription(_admin: SaasAdminSafe, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { id: true, businessName: true, status: true },
    });
    if (!client) {
      throw new NotFoundException({ message: 'Client not found', code: 'SAAS_CLIENT_NOT_FOUND' });
    }
    const sub = await this.getPrimarySubscriptionForClient(clientId);
    if (!sub) {
      return { clientId, client, subscription: null, usage: { users: 0, branches: 0, devicesActive: 0 } };
    }
    const [usersCount, branchesCount, devicesActive] = await Promise.all([
      this.prisma.user.count({ where: { clientId } }),
      this.prisma.branch.count({ where: { clientId } }),
      this.prisma.device.count({ where: { clientId, isActive: true } }),
    ]);
    return {
      clientId,
      client,
      subscription: {
        id: sub.id,
        status: sub.status,
        startsAt: sub.startsAt.toISOString(),
        expiresAt: sub.expiresAt?.toISOString() ?? null,
        graceDays: sub.graceDays,
        maxUsers: sub.maxUsers,
        maxBranches: sub.maxBranches,
        maxDevices: sub.maxDevices,
        plan: {
          id: sub.plan.id,
          code: sub.plan.code,
          name: sub.plan.name,
          features: sub.plan.features,
        },
      },
      usage: { users: usersCount, branches: branchesCount, devicesActive },
    };
  }

  async renewClientSubscription(admin: SaasAdminSafe, clientId: string, dto: RenewClientSubscriptionDto) {
    this.assertBillingOrSuper(admin);
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException({ message: 'Client not found', code: 'SAAS_CLIENT_NOT_FOUND' });
    }
    const sub = await this.getPrimarySubscriptionForClient(clientId);
    if (!sub) {
      throw new NotFoundException({ message: 'No subscription for client', code: 'SUBSCRIPTION_NOT_FOUND' });
    }
    if (sub.status === SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException({
        message: 'Subscription is suspended; reactivate before renewing',
        code: 'SUBSCRIPTION_SUSPENDED',
      });
    }
    const baseMs = Math.max(sub.expiresAt?.getTime() ?? Date.now(), Date.now());
    const newExpiresAt = new Date(baseMs + dto.extendDays * 86_400_000);
    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        expiresAt: newExpiresAt,
        status: SubscriptionStatus.ACTIVE,
      },
    });
    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.subscription.renew',
      entity: 'Subscription',
      entityId: sub.id,
      oldValue: { expiresAt: sub.expiresAt?.toISOString() ?? null },
      newValue: {
        expiresAt: updated.expiresAt?.toISOString() ?? null,
        extendDays: dto.extendDays,
        saasAdminId: admin.id,
      },
    });
    return {
      id: updated.id,
      expiresAt: updated.expiresAt?.toISOString() ?? null,
      status: updated.status,
    };
  }

  async changeClientPlan(admin: SaasAdminSafe, clientId: string, dto: ChangeClientPlanDto) {
    this.assertBillingOrSuper(admin);
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException({ message: 'Client not found', code: 'SAAS_CLIENT_NOT_FOUND' });
    }
    const sub = await this.getPrimarySubscriptionForClient(clientId);
    if (!sub) {
      throw new NotFoundException({ message: 'No subscription for client', code: 'SUBSCRIPTION_NOT_FOUND' });
    }
    const plan = await this.prisma.plan.findUnique({ where: { code: dto.planCode } });
    if (!plan) {
      throw new NotFoundException({ message: 'Plan not found', code: 'PLAN_NOT_FOUND' });
    }
    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planId: plan.id,
        maxUsers: plan.maxUsers,
        maxBranches: plan.maxBranches,
        maxDevices: plan.maxDevices,
        ...(dto.graceDays !== undefined ? { graceDays: dto.graceDays } : {}),
      },
    });
    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.subscription.change_plan',
      entity: 'Subscription',
      entityId: sub.id,
      oldValue: { planId: sub.planId, planCode: sub.plan.code },
      newValue: {
        planId: updated.planId,
        planCode: plan.code,
        saasAdminId: admin.id,
      },
    });
    return {
      id: updated.id,
      planCode: plan.code,
      maxUsers: updated.maxUsers,
      maxBranches: updated.maxBranches,
      maxDevices: updated.maxDevices,
      graceDays: updated.graceDays,
    };
  }

  async suspendClientSubscription(admin: SaasAdminSafe, clientId: string) {
    this.assertBillingOrSuper(admin);
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException({ message: 'Client not found', code: 'SAAS_CLIENT_NOT_FOUND' });
    }
    const sub = await this.getPrimarySubscriptionForClient(clientId);
    if (!sub) {
      throw new NotFoundException({ message: 'No subscription for client', code: 'SUBSCRIPTION_NOT_FOUND' });
    }
    if (sub.status === SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException({ message: 'Subscription is already suspended', code: 'SUBSCRIPTION_ALREADY_SUSPENDED' });
    }
    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.SUSPENDED },
    });
    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.subscription.suspend',
      entity: 'Subscription',
      entityId: sub.id,
      oldValue: { status: sub.status },
      newValue: { status: updated.status, saasAdminId: admin.id },
    });
    return { id: updated.id, status: updated.status };
  }

  async reactivateClientSubscription(admin: SaasAdminSafe, clientId: string) {
    this.assertBillingOrSuper(admin);
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException({ message: 'Client not found', code: 'SAAS_CLIENT_NOT_FOUND' });
    }
    const sub = await this.getPrimarySubscriptionForClient(clientId);
    if (!sub) {
      throw new NotFoundException({ message: 'No subscription for client', code: 'SUBSCRIPTION_NOT_FOUND' });
    }
    if (sub.status !== SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException({
        message: 'Only a suspended subscription can be reactivated',
        code: 'SUBSCRIPTION_NOT_SUSPENDED',
      });
    }
    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.ACTIVE },
    });
    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.subscription.reactivate',
      entity: 'Subscription',
      entityId: sub.id,
      oldValue: { status: sub.status },
      newValue: { status: updated.status, saasAdminId: admin.id },
    });
    return { id: updated.id, status: updated.status };
  }

  async create(admin: SaasAdminSafe, dto: CreateSaasClientDto) {
    if (admin.role !== SaasAdminRole.SUPER_ADMIN) {
      throw new ForbiddenException({
        message: 'Only SUPER_ADMIN can create clients',
        code: 'SAAS_CLIENTS_CREATE_DENIED',
      });
    }

    const slugBase = dto.slug?.trim() || dto.businessName;
    const slug = await this.resolveUniqueSlug(this.prisma, slugBase);

    const result = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          slug,
          businessName: dto.businessName.trim(),
          ownerName: dto.ownerName.trim(),
          email: dto.email.trim().toLowerCase(),
          phone: dto.phone?.trim() || null,
          status: ClientStatus.ACTIVE,
          notes: dto.notes?.trim() || null,
        },
      });

      const branch = await tx.branch.create({
        data: {
          clientId: client.id,
          name: 'Main',
          code: MAIN_BRANCH_CODE,
          isActive: true,
        },
      });

      await tx.storeSettings.create({
        data: {
          clientId: client.id,
          storeName: dto.businessName.trim(),
          currency: 'USD',
          taxEnabled: false,
          taxRate: new Prisma.Decimal(0),
          lowStockDefault: 5,
        },
      });

      if (dto.owner) {
        const username = dto.owner.username.trim().toLowerCase();
        const passwordHash = await hash(dto.owner.password, BCRYPT_ROUNDS);
        const user = await tx.user.create({
          data: {
            clientId: client.id,
            name: dto.owner.name.trim(),
            username,
            email: dto.owner.email?.trim().toLowerCase() ?? null,
            passwordHash,
            role: UserRole.OWNER,
            isActive: true,
          },
        });
        await tx.userBranch.create({
          data: { userId: user.id, branchId: branch.id },
        });
      }

      if (dto.subscription) {
        const plan = await tx.plan.findUnique({ where: { code: dto.subscription.planCode } });
        if (!plan) {
          throw new NotFoundException({ message: 'Plan not found', code: 'PLAN_NOT_FOUND' });
        }
        const termDays = dto.subscription.termDays ?? 365;
        const startsAt = new Date();
        const expiresAt = new Date(startsAt.getTime() + termDays * 86_400_000);
        await tx.subscription.create({
          data: {
            clientId: client.id,
            planId: plan.id,
            status: SubscriptionStatus.ACTIVE,
            startsAt,
            expiresAt,
            maxUsers: dto.subscription.maxUsers ?? plan.maxUsers,
            maxBranches: dto.subscription.maxBranches ?? plan.maxBranches,
            maxDevices: dto.subscription.maxDevices ?? plan.maxDevices,
            graceDays: dto.subscription.graceDays ?? 7,
          },
        });
      }

      return client;
    });

    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.clients.create',
      entity: 'Client',
      entityId: result.id,
      newValue: {
        slug: result.slug,
        businessName: result.businessName,
        saasAdminId: admin.id,
        createdOwner: Boolean(dto.owner),
        createdSubscription: Boolean(dto.subscription),
      },
    });

    return this.findOne(admin, result.id);
  }

  private async applySubscriptionPatch(
    tx: Prisma.TransactionClient,
    clientId: string,
    patch: NonNullable<PatchSaasClientDto['subscription']>,
  ) {
    const patchKeys = definedKeys(patch);
    if (patchKeys.length === 0) {
      return;
    }

    let sub = await tx.subscription.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });

    let planId = sub?.planId;
    let planRow = sub
      ? await tx.plan.findUnique({ where: { id: sub.planId } })
      : null;
    if (patch.planCode !== undefined) {
      const plan = await tx.plan.findUnique({ where: { code: patch.planCode } });
      if (!plan) {
        throw new NotFoundException({ message: 'Plan not found', code: 'PLAN_NOT_FOUND' });
      }
      planId = plan.id;
      planRow = plan;
    }

    if (!sub) {
      if (planId === undefined) {
        throw new BadRequestException({
          message: 'subscription.planCode is required when the client has no subscription',
          code: 'SUBSCRIPTION_PLAN_REQUIRED',
        });
      }
      const p = planRow ?? (await tx.plan.findUnique({ where: { id: planId } }));
      if (!p) {
        throw new NotFoundException({ message: 'Plan not found', code: 'PLAN_NOT_FOUND' });
      }
      const startsAt = new Date();
      const expiresAt =
        patch.expiresAt !== undefined
          ? new Date(patch.expiresAt)
          : new Date(startsAt.getTime() + 365 * 86_400_000);
      await tx.subscription.create({
        data: {
          clientId,
          planId,
          status: patch.status ?? SubscriptionStatus.ACTIVE,
          startsAt,
          expiresAt,
          maxUsers: patch.maxUsers ?? p.maxUsers,
          maxBranches: patch.maxBranches ?? p.maxBranches,
          maxDevices: patch.maxDevices ?? p.maxDevices,
          graceDays: patch.graceDays ?? 7,
        },
      });
      return;
    }

    await tx.subscription.update({
      where: { id: sub.id },
      data: {
        ...(planId !== undefined ? { planId } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.expiresAt !== undefined ? { expiresAt: new Date(patch.expiresAt) } : {}),
        ...(patch.maxUsers !== undefined ? { maxUsers: patch.maxUsers } : {}),
        ...(patch.maxBranches !== undefined ? { maxBranches: patch.maxBranches } : {}),
        ...(patch.maxDevices !== undefined ? { maxDevices: patch.maxDevices } : {}),
        ...(patch.graceDays !== undefined ? { graceDays: patch.graceDays } : {}),
        ...(planRow && patch.planCode !== undefined && patch.maxUsers === undefined
          ? {
              maxUsers: planRow.maxUsers,
              maxBranches: patch.maxBranches ?? planRow.maxBranches,
              maxDevices: patch.maxDevices ?? planRow.maxDevices,
            }
          : {}),
      },
    });
  }

  async update(admin: SaasAdminSafe, id: string, dto: PatchSaasClientDto) {
    const keys = definedKeys(dto);
    if (keys.length === 0) {
      throw new BadRequestException({ message: 'No fields to update', code: 'EMPTY_UPDATE' });
    }
    if (
      admin.role === SaasAdminRole.BILLING &&
      dto.subscription &&
      definedKeys(dto.subscription).length === 0
    ) {
      throw new BadRequestException({
        message: 'subscription payload cannot be empty',
        code: 'EMPTY_SUBSCRIPTION_PATCH',
      });
    }
    this.assertPatchBodyForRole(admin, dto);
    const existing = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Client not found', code: 'SAAS_CLIENT_NOT_FOUND' });
    }

    await this.prisma.$transaction(async (tx) => {
      if (admin.role === SaasAdminRole.SUPPORT) {
        await tx.client.update({
          where: { id },
          data: { supportNotes: dto.supportNotes?.trim() || null },
        });
        return;
      }

      if (dto.slug !== undefined && dto.slug !== existing.slug) {
        const clash = await tx.client.findFirst({
          where: { slug: dto.slug, NOT: { id }, deletedAt: null },
          select: { id: true },
        });
        if (clash) {
          throw new ConflictException({ message: 'Slug already in use', code: 'CLIENT_SLUG_TAKEN' });
        }
      }

      const data: Prisma.ClientUpdateInput = {
        ...(dto.slug !== undefined ? { slug: dto.slug.trim() } : {}),
        ...(dto.businessName !== undefined ? { businessName: dto.businessName.trim() } : {}),
        ...(dto.ownerName !== undefined ? { ownerName: dto.ownerName.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.supportNotes !== undefined ? { supportNotes: dto.supportNotes?.trim() || null } : {}),
      };

      if (admin.role === SaasAdminRole.BILLING) {
        if (dto.subscription) {
          await this.applySubscriptionPatch(tx, id, dto.subscription);
        }
        return;
      }

      if (Object.keys(data).length > 0) {
        await tx.client.update({ where: { id }, data });
      }
      if (dto.subscription) {
        await this.applySubscriptionPatch(tx, id, dto.subscription);
      }
    });

    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.clients.update',
      entity: 'Client',
      entityId: id,
      oldValue: { slug: existing.slug, status: existing.status },
      newValue: { saasAdminId: admin.id, role: admin.role, fields: definedKeys(dto) },
    });

    return this.findOne(admin, id);
  }

  async updateStatus(admin: SaasAdminSafe, id: string, dto: PatchSaasClientStatusDto) {
    if (admin.role !== SaasAdminRole.SUPER_ADMIN && admin.role !== SaasAdminRole.BILLING) {
      throw new ForbiddenException({
        message: 'Only SUPER_ADMIN or BILLING can update client status',
        code: 'SAAS_CLIENTS_STATUS_DENIED',
      });
    }
    const existing = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Client not found', code: 'SAAS_CLIENT_NOT_FOUND' });
    }
    const updated = await this.prisma.client.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.clients.status',
      entity: 'Client',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: updated.status, saasAdminId: admin.id },
    });
    return this.findOne(admin, id);
  }

  async softDelete(admin: SaasAdminSafe, id: string) {
    if (admin.role !== SaasAdminRole.SUPER_ADMIN) {
      throw new ForbiddenException({
        message: 'Only SUPER_ADMIN can delete clients',
        code: 'SAAS_CLIENTS_DELETE_DENIED',
      });
    }
    const existing = await this.prisma.client.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException({ message: 'Client not found', code: 'SAAS_CLIENT_NOT_FOUND' });
    }
    const now = new Date();
    await this.prisma.client.update({
      where: { id },
      data: {
        deletedAt: now,
        status: ClientStatus.INACTIVE,
      },
    });
    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.clients.soft_delete',
      entity: 'Client',
      entityId: id,
      oldValue: { deletedAt: null, status: existing.status },
      newValue: { deletedAt: now.toISOString(), saasAdminId: admin.id },
    });
    return { id, deleted: true };
  }

  async listAuditLogs(
    _admin: SaasAdminSafe,
    query: { page?: number; limit?: number; clientId?: string; action?: string; entity?: string },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
      ...(query.entity ? { entity: { equals: query.entity, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          createdAt: true,
          clientId: true,
          userId: true,
          client: { select: { businessName: true } },
          user: { select: { username: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listAllActivationCodes(
    _admin: SaasAdminSafe,
    query: { page?: number; limit?: number; status?: string; clientId?: string; q?: string },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const statusFilter = query.status as ActivationCodeStatus | undefined;

    const where: Prisma.ActivationCodeWhereInput = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(query.q
        ? {
            client: { businessName: { contains: query.q, mode: 'insensitive' } },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.activationCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          label: true,
          maxUses: true,
          usedCount: true,
          validUntil: true,
          createdAt: true,
          revokedAt: true,
          clientId: true,
          client: { select: { businessName: true } },
          plan: { select: { name: true, code: true } },
        },
      }),
      this.prisma.activationCode.count({ where }),
    ]);

    return {
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
