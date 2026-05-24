import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SaasAdminRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SaasJwtPayload } from '../types/saas-jwt-payload.type';

export type SaasAdminSafe = {
  id: string;
  email: string;
  name: string;
  role: SaasAdminRole;
};

@Injectable()
export class SaasJwtStrategy extends PassportStrategy(Strategy, 'saas-jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('saasJwt.secret'),
    });
  }

  async validate(payload: SaasJwtPayload): Promise<SaasAdminSafe> {
    if (payload.typ !== 'saas-admin') {
      throw new UnauthorizedException({
        message: 'This route requires a SaaS admin token',
        code: 'SAAS_AUTH_INVALID',
      });
    }
    const admin = await this.prisma.saaSAdmin.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException({ message: 'Account inactive', code: 'SAAS_AUTH_INACTIVE' });
    }
    if (payload.role !== undefined && payload.role !== admin.role) {
      throw new UnauthorizedException({
        message: 'Session outdated. Please sign in again.',
        code: 'SAAS_AUTH_STALE_ROLE',
      });
    }
    return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
  }
}
