import {
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { sanitizeUser } from './utils/sanitize-user';
import { BranchScopeService } from '../branch/branch-scope.service';

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
  ) {}

  async login(dto: LoginDto, req: Request) {
    const ip = this.clientIp(req);
    const username = dto.username.trim().toLowerCase();
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
          newValue: { username, clientSlug: slug, ip, reason: 'client_not_found' },
        });
        throw new UnauthorizedException({
          message: 'Invalid store or credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }
      clientId = client.id;
    }

    const user = clientId
      ? await this.prisma.user.findFirst({
          where: { username, clientId, isActive: true },
        })
      : await this.resolveUserWhenSlugOmitted(username);

    if (!user || !user.isActive) {
      await this.writeAudit({
        userId: null,
        clientId: clientId ?? null,
        action: 'auth.login.failed',
        entity: 'User',
        entityId: null,
        newValue: { username, ip, reason: 'user_not_found_or_inactive', clientSlug: slug ?? null },
      });
      throw new UnauthorizedException({
        message: 'Invalid username or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Account lockout check
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
        newValue: { username, ip, reason: 'invalid_password', attempts },
      });

      if (lockUntil) {
        throw new ForbiddenException({
          message: `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`,
          code: 'ACCOUNT_LOCKED',
        });
      }
      throw new UnauthorizedException({
        message: 'Invalid username or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Reset lockout on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    await this.writeAudit({
      userId: user.id,
      clientId: user.clientId,
      action: 'auth.login.success',
      entity: 'User',
      entityId: user.id,
      newValue: { username: user.username, ip },
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

    const safe = sanitizeUser(user);
    const branches = await this.branchScope.listBranchesForUser(safe);

    return { accessToken, refreshToken, user: safe, branches };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = await hash(rawRefreshToken, 10);

    // Find user by matching stored refresh token hash
    const user = await this.prisma.user.findFirst({
      where: { refreshTokenHash: { not: null }, isActive: true },
      select: {
        id: true, username: true, role: true, clientId: true,
        refreshTokenHash: true, lockedUntil: true,
      },
    });

    // We search by comparing hashes — scan is acceptable for low traffic,
    // but for scale you'd index a separate lookup token.
    let matchedUser = null;
    if (user) {
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

  private async resolveUserWhenSlugOmitted(username: string) {
    const matches = await this.prisma.user.findMany({
      where: { username, isActive: true },
      take: 5,
    });
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) {
      throw new BadRequestException({
        message: 'Multiple stores use this username. Pass clientSlug to choose your store.',
        code: 'CLIENT_SLUG_REQUIRED',
      });
    }
    return null;
  }

  async logout(userId: string, req: Request) {
    const ip = this.clientIp(req);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { clientId: true },
    });
    // Invalidate refresh token on logout
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
