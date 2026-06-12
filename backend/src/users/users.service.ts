import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { PlanLimitService } from '../common/services/plan-limit.service';
import { SafeUser } from '../auth/types/safe-user.type';
import { sanitizeUser } from '../auth/utils/sanitize-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { NotificationService } from '../notifications/notification.service';
import { PermissionsService } from '../permissions/permissions.service';
import { BusinessType } from '@prisma/client';
import { SalesmanIdService } from './salesman-id.service';
import { ApprovalIdService, REFUND_APPROVAL_ROLES } from './approval-id.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly planLimit: PlanLimitService,
    private readonly notifications: NotificationService,
    private readonly permissions: PermissionsService,
    private readonly salesmanId: SalesmanIdService,
    private readonly approvalId: ApprovalIdService,
  ) {}

  private listWhereForActor(actor: SafeUser): Prisma.UserWhereInput {
    const base: Prisma.UserWhereInput = { clientId: actor.clientId };
    if (this.isAdminLevel(actor.role)) {
      return { ...base, role: UserRole.CASHIER };
    }
    return base;
  }

  private assertAdminTargetsCashierOnly(actor: SafeUser, target: Pick<User, 'role' | 'clientId'>): void {
    if (!this.isAdminLevel(actor.role)) return;
    if (target.clientId !== actor.clientId) {
      throw new ForbiddenException({
        message: 'You do not have access to this user',
        code: 'USER_ACCESS_DENIED',
      });
    }
    if (target.role !== UserRole.CASHIER) {
      throw new ForbiddenException({
        message: 'Administrators may only manage cashier accounts',
        code: 'USER_MANAGE_CASHIER_ONLY',
      });
    }
  }

  private isAdminLevel(role: UserRole): boolean {
    return role === UserRole.ADMIN || role === UserRole.GENERAL_MANAGER;
  }

  private assertAdminCreateRole(actor: SafeUser, role: UserRole): void {
    if (this.isAdminLevel(actor.role) && role !== UserRole.CASHIER) {
      throw new ForbiddenException({
        message: 'Administrators may only create cashier accounts',
        code: 'USER_CREATE_CASHIER_ONLY',
      });
    }
  }

  private assertAdminRoleChange(actor: SafeUser, nextRole: UserRole, target: User): void {
    if (!this.isAdminLevel(actor.role)) return;
    if (nextRole !== UserRole.CASHIER) {
      throw new ForbiddenException({
        message: 'Administrators may only assign the cashier role',
        code: 'USER_ROLE_ASSIGN_CASHIER_ONLY',
      });
    }
    if (target.role !== UserRole.CASHIER) {
      throw new ForbiddenException({
        message: 'Administrators may only manage cashier accounts',
        code: 'USER_MANAGE_CASHIER_ONLY',
      });
    }
  }

  async findAll(actor: SafeUser, query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.listWhereForActor(actor);

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: rows.map((u) => sanitizeUser(u)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  private async getUserOrThrow(actor: SafeUser, id: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id, clientId: actor.clientId },
    });
    if (!user) {
      throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }
    return user;
  }

  async create(actor: SafeUser, dto: CreateUserDto) {
    this.assertAdminCreateRole(actor, dto.role);
    if (dto.role === UserRole.OWNER && actor.role !== UserRole.OWNER) {
      throw new ForbiddenException({
        message: 'Only the owner can create another owner account',
        code: 'OWNER_CREATE_FORBIDDEN',
      });
    }
    await this.assertRoleAllowedForClient(actor, dto.role);
    await this.planLimit.assertCanCreateUser(actor.clientId);
    const username = dto.username.trim().toLowerCase();
    const emailNorm = dto.email?.trim() ? dto.email.trim().toLowerCase() : undefined;

    await this.assertUsernameAvailable(actor.clientId, username);
    if (emailNorm) await this.assertEmailAvailable(actor.clientId, emailNorm);

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
    let salesmanIdCode: string | null = null;
    if (dto.role === UserRole.SALESMAN) {
      salesmanIdCode = await this.salesmanId.generateSalesmanIdCode(actor.clientId, dto.name.trim());
    }

    let approvalIdCode: string | null = null;
    if (REFUND_APPROVAL_ROLES.includes(dto.role)) {
      approvalIdCode = await this.approvalId.generateApprovalIdCode(actor.clientId, dto.name.trim());
    }

    const user = await this.prisma.user.create({
      data: {
        clientId: actor.clientId,
        name: dto.name.trim(),
        username,
        email: emailNorm ?? null,
        passwordHash,
        role: dto.role,
        salesmanIdCode,
        approvalIdCode,
        emailVerified: Boolean(emailNorm),
        emailVerifiedAt: emailNorm ? new Date() : null,
      },
    });

    await this.audit.log({
      userId: actor.id,
      clientId: actor.clientId,
      action: 'users.create',
      entity: 'User',
      entityId: user.id,
      newValue: {
        username: user.username,
        role: user.role,
        isActive: user.isActive,
      },
    });

    void this.notifications
      .notifyUserCreated({
        clientId: actor.clientId,
        newUserName: user.name,
        newUserEmail: user.email,
        newUserRole: user.role,
        createdByName: actor.name,
      })
      .catch(() => undefined);

    return sanitizeUser(user);
  }

  async update(actor: SafeUser, id: string, dto: UpdateUserDto) {
    const existing = await this.getUserOrThrow(actor, id);
    this.assertAdminTargetsCashierOnly(actor, existing);

    if (dto.role !== undefined && dto.role !== existing.role) {
      this.assertAdminRoleChange(actor, dto.role, existing);
      if (dto.role === UserRole.OWNER && actor.role !== UserRole.OWNER) {
        throw new ForbiddenException({
          message: 'Only the owner can assign the owner role',
          code: 'OWNER_ASSIGN_FORBIDDEN',
        });
      }
      await this.assertRoleAllowedForClient(actor, dto.role);
    }

    if (dto.username !== undefined) {
      const next = dto.username.trim().toLowerCase();
      if (next !== existing.username) {
        await this.assertUsernameAvailable(actor.clientId, next, id);
      }
    }

    if (dto.email !== undefined) {
      const raw = dto.email === null || dto.email === undefined ? '' : String(dto.email).trim();
      const nextEmail = raw === '' ? null : raw.toLowerCase();
      if (nextEmail && nextEmail !== existing.email?.toLowerCase()) {
        await this.assertEmailAvailable(actor.clientId, nextEmail, id);
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.username !== undefined) data.username = dto.username.trim().toLowerCase();
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.email !== undefined) {
      const raw = dto.email === null || dto.email === undefined ? '' : String(dto.email).trim();
      data.email = raw === '' ? null : raw.toLowerCase();
    }

    const nextRole = dto.role ?? existing.role;
    const nextName = dto.name !== undefined ? dto.name.trim() : existing.name;
    if (nextRole === UserRole.SALESMAN && !existing.salesmanIdCode) {
      data.salesmanIdCode = await this.salesmanId.generateSalesmanIdCode(actor.clientId, nextName);
    }
    if (REFUND_APPROVAL_ROLES.includes(nextRole) && !existing.approvalIdCode) {
      data.approvalIdCode = await this.approvalId.generateApprovalIdCode(actor.clientId, nextName);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        message: 'No fields to update',
        code: 'USER_UPDATE_EMPTY',
      });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
    });

    await this.audit.log({
      userId: actor.id,
      clientId: actor.clientId,
      action: 'users.update',
      entity: 'User',
      entityId: id,
      oldValue: {
        name: existing.name,
        username: existing.username,
        role: existing.role,
        email: existing.email,
      },
      newValue: {
        name: updated.name,
        username: updated.username,
        role: updated.role,
        email: updated.email,
      },
    });

    return sanitizeUser(updated);
  }

  async setPassword(actor: SafeUser, id: string, dto: UpdateUserPasswordDto) {
    const existing = await this.getUserOrThrow(actor, id);
    this.assertAdminTargetsCashierOnly(actor, existing);

    const passwordHash = await hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    await this.audit.log({
      userId: actor.id,
      clientId: actor.clientId,
      action: 'users.password_reset',
      entity: 'User',
      entityId: id,
      newValue: { targetUsername: existing.username },
    });

    const fresh = await this.getUserOrThrow(actor, id);
    return sanitizeUser(fresh);
  }

  async setStatus(actor: SafeUser, id: string, dto: UpdateUserStatusDto) {
    const existing = await this.getUserOrThrow(actor, id);
    this.assertAdminTargetsCashierOnly(actor, existing);

    if (id === actor.id && dto.isActive === false) {
      throw new BadRequestException({
        message: 'You cannot deactivate your own account',
        code: 'USER_SELF_DEACTIVATE',
      });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
    });

    await this.audit.log({
      userId: actor.id,
      clientId: actor.clientId,
      action: 'users.status_change',
      entity: 'User',
      entityId: id,
      oldValue: { isActive: existing.isActive },
      newValue: { isActive: updated.isActive },
    });

    return sanitizeUser(updated);
  }

  private async assertUsernameAvailable(
    clientId: string,
    username: string,
    excludeUserId?: string,
  ): Promise<void> {
    const clash = await this.prisma.user.findFirst({
      where: {
        clientId,
        username,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
    });
    if (clash) {
      throw new ConflictException({
        message: 'Username is already taken',
        code: 'USERNAME_TAKEN',
      });
    }
  }

  private async assertEmailAvailable(
    clientId: string,
    email: string,
    excludeUserId?: string,
  ): Promise<void> {
    const clash = await this.prisma.user.findFirst({
      where: {
        clientId,
        email,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
    });
    if (clash) {
      throw new ConflictException({
        message: 'Email is already in use',
        code: 'EMAIL_TAKEN',
      });
    }
  }

  private async assertRoleAllowedForClient(actor: SafeUser, role: UserRole): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: actor.clientId },
      select: { businessType: true },
    });
    const businessType = client?.businessType ?? BusinessType.RETAIL;
    if (!this.permissions.isRoleAllowedForBusinessType(role, businessType)) {
      throw new BadRequestException({
        message: `Role ${role} is not available for this business type`,
        code: 'ROLE_NOT_ALLOWED_FOR_BUSINESS_TYPE',
      });
    }
  }
}
