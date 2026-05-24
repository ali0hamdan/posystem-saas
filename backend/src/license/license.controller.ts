import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SafeUser } from '../auth/types/safe-user.type';
import { LicenseService } from './license.service';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { LicenseCheckDto } from './dto/license-check.dto';

function pickLicenseHeader(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v ?? '').trim();
}

@Controller('license')
export class LicenseController {
  constructor(private readonly license: LicenseService) {}

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  activate(@Body() dto: ActivateLicenseDto) {
    return this.license.activate(dto);
  }

  @Get('public-key')
  publicKey() {
    return { publicKeyPem: this.license.getPublicKeyPem() };
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  licenseStatus(
    @Headers('x-license-token') hdr?: string | string[],
    @Query('token') queryToken?: string,
  ) {
    const token = pickLicenseHeader(hdr) || (queryToken ?? '').trim();
    return this.license.getLicenseStatus(token);
  }

  @Post('check')
  @HttpCode(HttpStatus.OK)
  licenseCheck(@Headers('x-license-token') hdr?: string | string[], @Body() body?: LicenseCheckDto) {
    const token = pickLicenseHeader(hdr) || body?.licenseToken?.trim() || '';
    return this.license.checkLicense(token);
  }

  @Post('ping')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  ping(@CurrentUser() user: SafeUser, @Headers('x-license-token') hdr?: string | string[]) {
    const token = pickLicenseHeader(hdr);
    if (!token) {
      throw new UnauthorizedException({ message: 'Missing X-License-Token', code: 'LICENSE_TOKEN_MISSING' });
    }
    return this.license.ping(user.id, token);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  refresh(@CurrentUser() user: SafeUser, @Headers('x-license-token') hdr?: string | string[]) {
    const token = pickLicenseHeader(hdr);
    if (!token) {
      throw new UnauthorizedException({ message: 'Missing X-License-Token', code: 'LICENSE_TOKEN_MISSING' });
    }
    return this.license.refresh(user.id, token);
  }
}
