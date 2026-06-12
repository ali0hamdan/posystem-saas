import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../feature/feature.guard';
import { RequireFeature } from '../feature/require-feature.decorator';
import { FnbKitchenService } from './kitchen.service';
import { ListKitchenQueryDto, SetKitchenStatusDto } from './dto/kitchen.dto';

@Controller('fnb/kitchen')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN)
@RequireFeature('kitchen_display')
export class FnbKitchenController {
  constructor(private readonly service: FnbKitchenService) {}

  @Get()
  list(@Query() query: ListKitchenQueryDto, @CurrentUser() user: SafeUser, @Headers('x-branch-id') branchId?: string) {
    return this.service.list(user.clientId, branchId, query);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetKitchenStatusDto, @CurrentUser() user: SafeUser) {
    return this.service.setStatus(id, dto.status, user);
  }
}
