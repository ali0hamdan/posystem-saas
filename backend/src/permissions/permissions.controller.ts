import { Controller, Get, UseGuards } from '@nestjs/common';
import { BusinessType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/types/safe-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(
    private readonly permissions: PermissionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: SafeUser) {
    return {
      role: user.role,
      permissions: this.permissions.getPermissionsForRole(user.role),
    };
  }

  @Get('roles')
  async roles(@CurrentUser() user: SafeUser) {
    const client = await this.prisma.client.findUnique({
      where: { id: user.clientId },
      select: { businessType: true },
    });
    const businessType = client?.businessType ?? BusinessType.RETAIL;
    return this.permissions.getRoleMeta(businessType);
  }
}
