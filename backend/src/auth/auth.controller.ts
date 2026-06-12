import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsNotEmpty } from 'class-validator';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { SafeUser } from './types/safe-user.type';
import { BusinessType, UserRole } from '@prisma/client';
import { BranchScopeService } from '../branch/branch-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { SalesmanIdService } from '../users/salesman-id.service';
import { resolveDashboardPath } from '../common/dashboard-path.util';

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly branchScope: BranchScopeService,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly salesmanId: SalesmanIdService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: SafeUser) {
    let currentUser = user;
    if (user.role === UserRole.SALESMAN && !user.salesmanIdCode) {
      const code = await this.salesmanId.ensureSalesmanHasCode(user);
      if (code) currentUser = { ...user, salesmanIdCode: code };
    }

    const [branches, client, sub] = await Promise.all([
      this.branchScope.listBranchesForUser(currentUser),
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
    const businessType = (client?.businessType ?? BusinessType.RETAIL) as BusinessType;
    return {
      user: currentUser,
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

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: SafeUser, @Req() req: Request) {
    return this.authService.logout(user.id, req);
  }
}
