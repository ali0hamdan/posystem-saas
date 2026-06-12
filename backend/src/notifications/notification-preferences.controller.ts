import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/types/safe-user.type';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdateNotificationPreferenceDto } from './dto/notification-preference.dto';

@Controller('settings/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationPreferencesController {
  constructor(private readonly prefs: NotificationPreferencesService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  list(@CurrentUser() user: SafeUser) {
    return this.prefs.list(user.clientId);
  }

  @Patch()
  @Roles(UserRole.OWNER)
  update(@Body() dto: UpdateNotificationPreferenceDto, @CurrentUser() user: SafeUser) {
    return this.prefs.update(user.clientId, user.id, dto);
  }
}
