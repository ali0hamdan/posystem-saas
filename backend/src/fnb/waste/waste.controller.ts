import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureGuard } from '../feature/feature.guard';
import { RequireFeature } from '../feature/require-feature.decorator';
import { WasteService } from './waste.service';
import { CreateWasteDto, ListWasteQueryDto } from './dto/waste.dto';

@Controller('fnb/waste')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN, UserRole.CASHIER)
@RequireFeature('fnb_module')
export class WasteController {
  constructor(private readonly service: WasteService) {}

  @Get()
  list(@Query() query: ListWasteQueryDto, @CurrentUser() user: SafeUser, @Headers('x-branch-id') branchId?: string) {
    return this.service.list(user.clientId, branchId, query);
  }

  @Post()
  create(@Body() dto: CreateWasteDto, @CurrentUser() user: SafeUser, @Headers('x-branch-id') branchId?: string) {
    return this.service.create(dto, user, branchId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SafeUser) {
    return this.service.remove(id, user);
  }
}
