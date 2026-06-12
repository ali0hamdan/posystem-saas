import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { OtpPurpose, Prisma } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailDeliveryError, EmailService } from '../email/email.service';
import {
  OTP_BCRYPT_ROUNDS,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
} from './otp.constants';

export interface CreateOtpParams {
  email: string;
  purpose: OtpPurpose;
  userId?: string | null;
  clientId?: string | null;
}

export interface VerifyOtpParams {
  email: string;
  purpose: OtpPurpose;
  code: string;
}

export interface VerifyOtpResult {
  userId: string | null;
  clientId: string | null;
  otpId: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  generateOtp(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  async hashOtp(code: string): Promise<string> {
    return hash(code, OTP_BCRYPT_ROUNDS);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async createOtp(params: CreateOtpParams): Promise<void> {
    const email = this.normalizeEmail(params.email);
    const now = new Date();

    const latest = await this.prisma.otpCode.findFirst({
      where: { email, purpose: params.purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (latest) {
      const elapsed = (now.getTime() - latest.createdAt.getTime()) / 1000;
      if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed);
        throw new HttpException(
          {
            message: `Please wait ${wait} second(s) before requesting a new code.`,
            code: 'OTP_RESEND_COOLDOWN',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const plain = this.generateOtp();
    const codeHash = await this.hashOtp(plain);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60_000);

    await this.prisma.$transaction(async (tx) => {
      await tx.otpCode.updateMany({
        where: {
          email,
          purpose: params.purpose,
          consumedAt: null,
        },
        data: { consumedAt: now },
      });

      await tx.otpCode.create({
        data: {
          email,
          purpose: params.purpose,
          codeHash,
          expiresAt,
          userId: params.userId ?? null,
          clientId: params.clientId ?? null,
          maxAttempts: OTP_MAX_ATTEMPTS,
        },
      });
    });

    try {
      await this.email.sendOtpEmail(email, plain, params.purpose);
    } catch (err) {
      await this.prisma.otpCode.updateMany({
        where: { email, purpose: params.purpose, consumedAt: null },
        data: { consumedAt: now },
      });
      if (err instanceof EmailDeliveryError) {
        throw new BadRequestException({
          message: err.message,
          code: 'EMAIL_SEND_FAILED',
        });
      }
      throw err;
    }

    this.logger.log(`OTP created for ${email} (purpose: ${params.purpose})`);
  }

  async verifyOtp(params: VerifyOtpParams): Promise<VerifyOtpResult> {
    const email = this.normalizeEmail(params.email);
    const code = params.code.trim();

    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException({
        message: 'Invalid verification code',
        code: 'OTP_INVALID_FORMAT',
      });
    }

    const record = await this.prisma.otpCode.findFirst({
      where: {
        email,
        purpose: params.purpose,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new UnauthorizedException({
        message: 'Invalid or expired verification code',
        code: 'OTP_INVALID',
      });
    }

    const now = new Date();
    if (record.expiresAt < now) {
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { consumedAt: now },
      });
      throw new UnauthorizedException({
        message: 'Invalid or expired verification code',
        code: 'OTP_EXPIRED',
      });
    }

    if (record.attempts >= record.maxAttempts) {
      throw new UnauthorizedException({
        message: 'Too many failed attempts. Request a new code.',
        code: 'OTP_MAX_ATTEMPTS',
      });
    }

    const ok = await compare(code, record.codeHash);
    if (!ok) {
      const attempts = record.attempts + 1;
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: {
          attempts,
          ...(attempts >= record.maxAttempts ? { consumedAt: now } : {}),
        },
      });
      throw new UnauthorizedException({
        message: 'Invalid or expired verification code',
        code: 'OTP_INVALID',
      });
    }

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: now },
    });

    this.logger.log(`OTP verified for ${email} (purpose: ${params.purpose})`);

    return {
      userId: record.userId,
      clientId: record.clientId,
      otpId: record.id,
    };
  }

  async invalidateAllForEmail(email: string, purpose: OtpPurpose): Promise<void> {
    await this.prisma.otpCode.updateMany({
      where: {
        email: this.normalizeEmail(email),
        purpose,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
  }
}
