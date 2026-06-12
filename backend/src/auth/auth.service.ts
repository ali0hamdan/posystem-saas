import {
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ClientStatus, OtpPurpose, Prisma, UserRole } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { sanitizeUser } from './utils/sanitize-user';
import { BranchScopeService } from '../branch/branch-scope.service';
import { resolveDashboardPath } from '../common/dashboard-path.util';
import { OtpService } from '../otp/otp.service';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notifications/notification.service';
import { PermissionsService } from '../permissions/permissions.service';
import { SalesmanIdService } from '../users/salesman-id.service';
import { assertStrongPassword } from '../common/utils/password.util';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly branchScope: BranchScopeService,
    private readonly otp: OtpService,
    private readonly email: EmailService,
    private readonly notifications: NotificationService,
    private readonly permissions: PermissionsService,
    private readonly salesmanId: SalesmanIdService,
  ) {}

  private resolveLoginKey(dto: LoginDto): string {
    const key = (dto.email ?? dto.identifier ?? dto.username ?? '').trim().toLowerCase();
    if (!key) {
      throw new BadRequestException({
        message: 'Email or username is required',
        code: 'LOGIN_IDENTIFIER_REQUIRED',
      });
    }
    return key;
  }

  async login(dto: LoginDto, req: Request) {
    const ip = this.clientIp(req);
    const loginKey = this.resolveLoginKey(dto);
    const slug = dto.clientSlug?.trim();

    let clientId: string | undefined;
    if (slug) {
      const client = await this.prisma.client.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!client) {
        await this.writeAudit({
          userId: null,
          clientId: null,
          action: 'auth.login.failed',
          entity: 'User',
          entityId: null,
          newValue: { loginKey, clientSlug: slug, ip, reason: 'client_not_found' },
        });
        throw new UnauthorizedException({
          message: 'Invalid store or credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }
      clientId = client.id;
    }

    const user = clientId
      ? await this.resolveUserInClient(loginKey, clientId)
      : await this.resolveUserGlobal(loginKey);

    if (!user) {
      await this.writeAudit({
        userId: null,
        clientId: clientId ?? null,
        action: 'auth.login.failed',
        entity: 'User',
        entityId: null,
        newValue: { loginKey, ip, reason: 'user_not_found', clientSlug: slug ?? null },
      });
      throw new UnauthorizedException({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException({
        message: `Account is locked. Try again in ${minutesLeft} minute(s).`,
        code: 'ACCOUNT_LOCKED',
      });
    }

    const passwordOk = await compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      const attempts = (user.loginAttempts ?? 0) + 1;
      const lockUntil = attempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: attempts, lockedUntil: lockUntil ?? undefined },
      });

      await this.writeAudit({
        userId: user.id,
        clientId: user.clientId,
        action: 'auth.login.failed',
        entity: 'User',
        entityId: user.id,
        newValue: { loginKey, ip, reason: 'invalid_password', attempts },
      });

      if (lockUntil) {
        throw new ForbiddenException({
          message: `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`,
          code: 'ACCOUNT_LOCKED',
        });
      }
      throw new UnauthorizedException({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (user.role === UserRole.OWNER && !user.emailVerified) {
      throw new ForbiddenException({
        message: 'Please verify your email first.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    if (!user.isActive) {
      const client = await this.prisma.client.findUnique({
        where: { id: user.clientId },
        select: { status: true },
      });
      if (client?.status === ClientStatus.PENDING_EMAIL_VERIFICATION) {
        throw new ForbiddenException({
          message: 'Please verify your email first.',
          code: 'EMAIL_NOT_VERIFIED',
        });
      }
      if (client?.status === ClientStatus.PENDING_PAYMENT) {
        throw new ForbiddenException({
          message: 'Please complete your subscription payment to access the dashboard.',
          code: 'PAYMENT_REQUIRED',
        });
      }
      await this.writeAudit({
        userId: user.id,
        clientId: user.clientId,
        action: 'auth.login.failed',
        entity: 'User',
        entityId: user.id,
        newValue: { loginKey, ip, reason: 'user_inactive' },
      });
      throw new UnauthorizedException({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    if (user.role === UserRole.SALESMAN && !user.salesmanIdCode) {
      user.salesmanIdCode = await this.salesmanId.ensureSalesmanHasCode(user);
    }

    await this.writeAudit({
      userId: user.id,
      clientId: user.clientId,
      action: 'auth.login.success',
      entity: 'User',
      entityId: user.id,
      newValue: { loginKey, ip },
    });

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      clientId: user.clientId,
      typ: 'store-user',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.generateRefreshToken(user.id),
    ]);

    const [branches, client, sub] = await Promise.all([
      this.branchScope.listBranchesForUser(sanitizeUser(user)),
      this.prisma.client.findUnique({
        where: { id: user.clientId },
        select: {
          id: true,
          businessName: true,
          businessType: true,
          status: true,
        },
      }),
      this.prisma.subscription.findFirst({
        where: { clientId: user.clientId },
        orderBy: [{ updatedAt: 'desc' }],
        select: {
          status: true,
          billingCycle: true,
          expiresAt: true,
          plan: { select: { code: true, name: true } },
        },
      }),
    ]);

    const businessType = client?.businessType ?? 'RETAIL';
    const safe = sanitizeUser(user, { subscriptionStatus: sub?.status ?? null });

    return {
      accessToken,
      refreshToken,
      user: safe,
      permissions: this.permissions.getPermissionsForRole(user.role),
      branches,
      businessType,
      subscriptionStatus: sub?.status ?? null,
      nextDashboardUrl: resolveDashboardPath(businessType),
      client: client
        ? {
            id: client.id,
            businessName: client.businessName,
            businessType: client.businessType,
            status: client.status,
          }
        : null,
      subscription: sub
        ? {
            status: sub.status,
            planCode: sub.plan.code,
            planName: sub.plan.name,
            billingCycle: sub.billingCycle,
            expiresAt: sub.expiresAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  private async resolveUserInClient(loginKey: string, clientId: string) {
    return this.prisma.user.findFirst({
      where: {
        clientId,
        OR: [
          { email: { equals: loginKey, mode: 'insensitive' } },
          { username: loginKey },
        ],
      },
    });
  }

  private async resolveUserGlobal(loginKey: string) {
    const matches = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { equals: loginKey, mode: 'insensitive' } },
          { username: loginKey },
        ],
      },
      take: 5,
    });
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) {
      throw new BadRequestException({
        message: 'Multiple stores use this login. Pass clientSlug to choose your store.',
        code: 'CLIENT_SLUG_REQUIRED',
      });
    }
    return null;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        isActive: true,
        emailVerified: true,
      },
      select: { id: true, email: true, clientId: true },
    });

    if (user?.email) {
      try {
        await this.otp.createOtp({
          email: user.email,
          purpose: OtpPurpose.PASSWORD_RESET,
          userId: user.id,
          clientId: user.clientId,
        });
      } catch (err) {
        this.logger.warn(`Forgot-password OTP could not be sent for ${email}`);
      }
    }

    return { message: 'If this email exists, a reset code has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    assertStrongPassword(dto.newPassword);

    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      select: { id: true, email: true, name: true, clientId: true },
    });
    if (!user?.email) {
      throw new UnauthorizedException({
        message: 'Invalid or expired verification code',
        code: 'OTP_INVALID',
      });
    }

    await this.otp.verifyOtp({
      email,
      purpose: OtpPurpose.PASSWORD_RESET,
      code: dto.otp,
    });

    const passwordHash = await hash(dto.newPassword, 12);
    const now = new Date();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        lastPasswordResetAt: now,
        refreshTokenHash: null,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.otp.invalidateAllForEmail(email, OtpPurpose.PASSWORD_RESET);
    await this.email.sendPasswordChangedConfirmation(email);

    void this.notifications
      .notifyPasswordReset({
        clientId: user.clientId,
        userName: user.name,
        userEmail: email,
      })
      .catch(() => undefined);

    await this.writeAudit({
      userId: user.id,
      clientId: user.clientId,
      action: 'auth.password.reset',
      entity: 'User',
      entityId: user.id,
      newValue: { email },
    });

    return { success: true, message: 'Password updated. You can sign in with your new password.' };
  }

  async refresh(rawRefreshToken: string) {
    let matchedUser = null;
    const allUsers = await this.prisma.user.findMany({
      where: { refreshTokenHash: { not: null }, isActive: true },
      select: {
        id: true, username: true, role: true, clientId: true,
        refreshTokenHash: true, lockedUntil: true,
      },
    });
    for (const u of allUsers) {
      if (u.refreshTokenHash && await compare(rawRefreshToken, u.refreshTokenHash)) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      throw new UnauthorizedException({ message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
    }

    if (matchedUser.lockedUntil && matchedUser.lockedUntil > new Date()) {
      throw new ForbiddenException({ message: 'Account is locked', code: 'ACCOUNT_LOCKED' });
    }

    const payload: JwtPayload = {
      sub: matchedUser.id,
      username: matchedUser.username,
      role: matchedUser.role,
      clientId: matchedUser.clientId,
      typ: 'store-user',
    };

    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.generateRefreshToken(matchedUser.id),
    ]);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(40).toString('hex');
    const hashed = await hash(raw, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hashed },
    });
    return raw;
  }

  async logout(userId: string, req: Request) {
    const ip = this.clientIp(req);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { clientId: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    await this.writeAudit({
      userId,
      clientId: user?.clientId ?? null,
      action: 'auth.logout',
      entity: 'User',
      entityId: userId,
      newValue: { ip },
    });
    return { success: true, message: 'Logged out' };
  }

  private clientIp(req: Request): string {
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }

  private async writeAudit(params: {
    userId: string | null;
    clientId: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    newValue: Prisma.InputJsonValue;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: params });
    } catch (err) {
      this.logger.warn(`Audit log write failed for action ${params.action}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
