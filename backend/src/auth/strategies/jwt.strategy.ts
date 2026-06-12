import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../types/jwt-payload.type';
import { sanitizeUser } from '../utils/sanitize-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const decodedTyp = (payload as unknown as { typ?: string }).typ;
    if (decodedTyp === 'saas-admin') {
      throw new UnauthorizedException({
        message: 'This route requires a store user token',
        code: 'AUTH_WRONG_TOKEN_TYPE',
      });
    }
    if (decodedTyp !== undefined && decodedTyp !== 'store-user') {
      throw new UnauthorizedException({
        message: 'Invalid token',
        code: 'AUTH_INVALID_TOKEN_TYPE',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        message: 'Account is inactive or no longer exists',
        code: 'AUTH_INVALID',
      });
    }

    if (!payload.clientId || payload.clientId !== user.clientId) {
      throw new UnauthorizedException({
        message: 'Session expired. Please sign in again.',
        code: 'AUTH_STALE_TOKEN',
      });
    }

    // Latest subscription drives the subscription-enforcement interceptor.
    // Prefer an ACTIVE/LIFETIME/TRIALING row; fall back to most-recent.
    const sub = await this.prisma.subscription.findFirst({
      where: { clientId: user.clientId },
      orderBy: [{ updatedAt: 'desc' }],
      select: { status: true },
    });

    return sanitizeUser(user, { subscriptionStatus: sub?.status ?? null });
  }
}
