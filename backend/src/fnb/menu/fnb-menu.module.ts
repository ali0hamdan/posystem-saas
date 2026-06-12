import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { FnbMenuService } from './menu.service';
import { MenuItemsController } from './menu-items.controller';
import { ModifierGroupsController } from './modifier-groups.controller';

@Module({
  imports: [AuthModule],
  controllers: [MenuItemsController, ModifierGroupsController],
  providers: [FnbMenuService],
  exports: [FnbMenuService],
})
export class FnbMenuModule {}
