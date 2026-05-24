import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { SignOptions } from 'jsonwebtoken';
import { LicenseModule } from '../license/license.module';
import { SaasAuthController } from './saas-auth.controller';
import { SaasClientsController } from './saas-clients.controller';
import { SaasAuthService } from './saas-auth.service';
import { SaasClientsService } from './saas-clients.service';
import { SaasJwtStrategy } from './strategies/saas-jwt.strategy';
import { SaasAuthGuard } from './guards/saas-auth.guard';
import { SaasRoleGuard } from './guards/saas-role.guard';
import { SaasPlansController } from './saas-plans.controller';
import { SaasPlansService } from './saas-plans.service';
import { SaasLicenseAdminController } from './saas-license-admin.controller';
import { SaasActivationCodesController } from './saas-activation-codes.controller';
import { SaasAuditLogsController } from './saas-audit-logs.controller';

@Module({
  imports: [
    PassportModule.register({}),
    LicenseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('saasJwt.secret'),
        signOptions: {
          expiresIn: (config.get<string>('saasJwt.expiresIn') ?? '12h') as SignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [
    SaasAuthController,
    SaasClientsController,
    SaasPlansController,
    SaasLicenseAdminController,
    SaasActivationCodesController,
    SaasAuditLogsController,
  ],
  providers: [
    SaasAuthService,
    SaasClientsService,
    SaasPlansService,
    SaasJwtStrategy,
    SaasAuthGuard,
    SaasRoleGuard,
  ],
  exports: [SaasAuthGuard, SaasRoleGuard],
})
export class SaasAuthModule {}
