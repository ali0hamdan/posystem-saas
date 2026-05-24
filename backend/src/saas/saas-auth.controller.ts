import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsString, Length, MinLength } from 'class-validator';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { SaasAuthService } from './saas-auth.service';
import { SaasLoginDto } from './dto/saas-login.dto';
import { SaasAuthGuard } from './guards/saas-auth.guard';
import { CurrentSaaSAdmin } from './decorators/current-saas-admin.decorator';
import type { SaasAdminSafe } from './strategies/saas-jwt.strategy';

class TotpCodeDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

class DisableTotpDto {
  @IsString()
  @MinLength(1)
  password!: string;
}

class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;
}

@Controller('saas/auth')
export class SaasAuthController {
  constructor(private readonly auth: SaasAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  login(@Body() dto: SaasLoginDto, @Req() req: Request) {
    return this.auth.login(dto.email.trim().toLowerCase(), dto.password, dto.totpCode, req);
  }

  @Get('me')
  @UseGuards(SaasAuthGuard)
  @SkipThrottle()
  me(@CurrentSaaSAdmin() admin: SaasAdminSafe) {
    return this.auth.me(admin);
  }

  @Post('logout')
  @UseGuards(SaasAuthGuard)
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  logout(@CurrentSaaSAdmin() admin: SaasAdminSafe, @Req() req: Request) {
    return this.auth.logout(admin, req);
  }

  /** Step 1: Generate TOTP secret + QR code. */
  @Post('totp/setup')
  @UseGuards(SaasAuthGuard)
  @HttpCode(HttpStatus.OK)
  setupTotp(@CurrentSaaSAdmin() admin: SaasAdminSafe) {
    return this.auth.setupTotp(admin.id);
  }

  /** Step 2: Confirm first TOTP code to activate 2FA. */
  @Post('totp/confirm')
  @UseGuards(SaasAuthGuard)
  @HttpCode(HttpStatus.OK)
  confirmTotp(@CurrentSaaSAdmin() admin: SaasAdminSafe, @Body() dto: TotpCodeDto) {
    return this.auth.confirmTotp(admin.id, dto.code);
  }

  /** Disable 2FA (requires current password). */
  @Post('totp/disable')
  @UseGuards(SaasAuthGuard)
  @HttpCode(HttpStatus.OK)
  disableTotp(@CurrentSaaSAdmin() admin: SaasAdminSafe, @Body() dto: DisableTotpDto) {
    return this.auth.disableTotp(admin.id, dto.password);
  }

  /** Change SaaS admin password. */
  @Post('change-password')
  @UseGuards(SaasAuthGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(@CurrentSaaSAdmin() admin: SaasAdminSafe, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(admin.id, dto.currentPassword, dto.newPassword);
  }
}
