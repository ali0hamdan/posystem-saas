import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { toDataURL } from 'qrcode';

// `speakeasy` is pure CommonJS (no ESM-only transitive deps). It replaced
// `otplib` here because otplib v13 transitively pulls @scure/base@^2 and
// @noble/hashes@^2 — both ESM-only — which crashes the packaged desktop
// backend (`require()` of ES Module) at module load before /health is up.
// See frontend/electron/DESKTOP_PACKAGING.md for the full incident notes.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const speakeasy = require('speakeasy') as {
  generateSecret: (opts?: { length?: number }) => { base32: string };
  totp: {
    (opts: { secret: string; encoding: 'base32' }): string;
    verify: (opts: { secret: string; encoding: 'base32'; token: string; window?: number }) => boolean;
  };
  otpauthURL: (opts: {
    secret: string;
    label: string;
    issuer?: string;
    encoding: 'base32';
  }) => string;
};

/** Thin compatibility shim — keeps the original call sites unchanged so the
 *  rest of this service doesn't need to learn speakeasy's API. */
const totp = {
  generateSecret(length = 20): string {
    return speakeasy.generateSecret({ length }).base32;
  },
  verify({ token, secret }: { token: string; secret: string }): boolean {
    // window: 1 = accept tokens generated up to one 30s step before/after,
    // matching otplib's default tolerance and most authenticator apps.
    return speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
  },
  toURI(account: string, service: string, secret: string): string {
    return speakeasy.otpauthURL({ secret, label: account, issuer: service, encoding: 'base32' });
  },
};
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import type { SaasJwtPayload } from './types/saas-jwt-payload.type';
import type { SaasAdminSafe } from './strategies/saas-jwt.strategy';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 30;

@Injectable()
export class SaasAuthService {
  private readonly logger = new Logger(SaasAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditLogService,
  ) {}

  private clientIp(req: Request): string {
    return req.ip ?? req.socket?.remoteAddress ?? '';
  }

  private toPublicAdmin(admin: {
    id: string;
    email: string;
    name: string;
    role: SaasAdminSafe['role'];
    totpEnabled: boolean;
  }): SaasAdminSafe & { totpEnabled: boolean } {
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      totpEnabled: admin.totpEnabled,
    };
  }

  async login(email: string, password: string, totpCode: string | undefined, req: Request) {
    const ip = this.clientIp(req);
    const normalizedEmail = email.trim().toLowerCase();

    const admin = await this.prisma.saaSAdmin.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true, email: true, name: true, role: true, isActive: true,
        passwordHash: true, loginAttempts: true, lockedUntil: true,
        totpSecret: true, totpEnabled: true,
      },
    });

    const auditFail = async (reason: string) => {
      await this.audit.log({
        userId: null, clientId: null,
        action: 'saas.auth.login.failed',
        entity: 'SaaSAdmin',
        entityId: admin?.id ?? null,
        newValue: { email: normalizedEmail, ip, reason },
      });
    };

    if (!admin || !admin.isActive) {
      await auditFail(!admin ? 'unknown_email' : 'inactive');
      throw new UnauthorizedException({ message: 'Invalid credentials', code: 'SAAS_AUTH_INVALID' });
    }

    // Lockout check
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      const mins = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException({
        message: `Account locked. Try again in ${mins} minute(s).`,
        code: 'ACCOUNT_LOCKED',
      });
    }

    const ok = await compare(password.trim(), admin.passwordHash);
    if (!ok) {
      const attempts = (admin.loginAttempts ?? 0) + 1;
      const lockUntil = attempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : undefined;
      await this.prisma.saaSAdmin.update({
        where: { id: admin.id },
        data: { loginAttempts: attempts, lockedUntil: lockUntil },
      });
      await auditFail('invalid_password');
      if (lockUntil) {
        throw new ForbiddenException({
          message: `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`,
          code: 'ACCOUNT_LOCKED',
        });
      }
      throw new UnauthorizedException({ message: 'Invalid credentials', code: 'SAAS_AUTH_INVALID' });
    }

    // TOTP check
    if (admin.totpEnabled && admin.totpSecret) {
      if (!totpCode) {
        throw new UnauthorizedException({ message: '2FA code required', code: 'TOTP_REQUIRED' });
      }
      const valid = totp.verify({ token: totpCode!, secret: admin.totpSecret });
      if (!valid) {
        await auditFail('invalid_totp');
        throw new UnauthorizedException({ message: 'Invalid 2FA code', code: 'TOTP_INVALID' });
      }
    }

    // Reset lockout on success
    await this.prisma.saaSAdmin.update({
      where: { id: admin.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    const payload: SaasJwtPayload = {
      sub: admin.id,
      typ: 'saas-admin',
      email: admin.email,
      role: admin.role,
    };

    const accessToken = await this.jwt.signAsync(payload);

    await this.audit.log({
      userId: null, clientId: null,
      action: 'saas.auth.login.success',
      entity: 'SaaSAdmin',
      entityId: admin.id,
      newValue: { email: admin.email, ip, role: admin.role },
    });

    return { accessToken, admin: this.toPublicAdmin(admin) };
  }

  me(admin: SaasAdminSafe) {
    return { admin };
  }

  async logout(admin: SaasAdminSafe, req: Request) {
    const ip = this.clientIp(req);
    await this.audit.log({
      userId: null, clientId: null,
      action: 'saas.auth.logout',
      entity: 'SaaSAdmin',
      entityId: admin.id,
      newValue: { email: admin.email, ip },
    });
    return { ok: true as const };
  }

  /** Generate a TOTP secret and return a QR code data URL for the authenticator app. */
  async setupTotp(adminId: string): Promise<{ secret: string; qrDataUrl: string }> {
    const admin = await this.prisma.saaSAdmin.findUniqueOrThrow({
      where: { id: adminId },
      select: { email: true, totpEnabled: true },
    });
    if (admin.totpEnabled) {
      throw new BadRequestException({ message: '2FA is already enabled', code: 'TOTP_ALREADY_ENABLED' });
    }
    const secret = totp.generateSecret(32);
    const otpauth = totp.toURI(admin.email, 'Stock POS Admin', secret);
    const qrDataUrl = await toDataURL(otpauth);

    // Store pending secret (not yet confirmed)
    await this.prisma.saaSAdmin.update({
      where: { id: adminId },
      data: { totpSecret: secret },
    });

    return { secret, qrDataUrl };
  }

  /** Confirm and activate TOTP by verifying the first code. */
  async confirmTotp(adminId: string, code: string): Promise<{ ok: boolean }> {
    const admin = await this.prisma.saaSAdmin.findUniqueOrThrow({
      where: { id: adminId },
      select: { totpSecret: true, totpEnabled: true },
    });
    if (admin.totpEnabled) {
      throw new BadRequestException({ message: '2FA is already enabled', code: 'TOTP_ALREADY_ENABLED' });
    }
    if (!admin.totpSecret) {
      throw new BadRequestException({ message: 'Run setup first', code: 'TOTP_NOT_INITIATED' });
    }
    const valid = totp.verify({ token: code, secret: admin.totpSecret });
    if (!valid) {
      throw new UnauthorizedException({ message: 'Invalid 2FA code', code: 'TOTP_INVALID' });
    }
    await this.prisma.saaSAdmin.update({
      where: { id: adminId },
      data: { totpEnabled: true },
    });
    return { ok: true };
  }

  /** Disable TOTP (requires current password confirmation). */
  async disableTotp(adminId: string, password: string): Promise<{ ok: boolean }> {
    const admin = await this.prisma.saaSAdmin.findUniqueOrThrow({
      where: { id: adminId },
      select: { passwordHash: true },
    });
    const ok = await compare(password, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ message: 'Invalid password', code: 'INVALID_CREDENTIALS' });
    }
    await this.prisma.saaSAdmin.update({
      where: { id: adminId },
      data: { totpEnabled: false, totpSecret: null },
    });
    return { ok: true };
  }

  /** Change SaaS admin password with current password verification. */
  async changePassword(adminId: string, currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
    const admin = await this.prisma.saaSAdmin.findUniqueOrThrow({
      where: { id: adminId },
      select: { passwordHash: true },
    });
    const ok = await compare(currentPassword, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ message: 'Current password is incorrect', code: 'INVALID_CREDENTIALS' });
    }
    if (newPassword.length < 12) {
      throw new BadRequestException({ message: 'New password must be at least 12 characters', code: 'PASSWORD_TOO_SHORT' });
    }
    const newHash = await hash(newPassword, 12);
    await this.prisma.saaSAdmin.update({
      where: { id: adminId },
      data: { passwordHash: newHash },
    });
    return { ok: true };
  }
}
