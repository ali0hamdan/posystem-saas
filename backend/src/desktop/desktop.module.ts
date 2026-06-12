import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DesktopOwnerController } from './desktop-owner.controller';
import { DesktopOwnerService } from './desktop-owner.service';

/**
 * Desktop-only endpoints. Registered unconditionally (the module is small),
 * but every controller method short-circuits when DESKTOP_MODE !== 'true'
 * so the routes are effectively a no-op for the hosted SaaS API.
 */
@Module({
  imports: [PrismaModule],
  controllers: [DesktopOwnerController],
  providers: [DesktopOwnerService],
  exports: [DesktopOwnerService],
})
export class DesktopModule {}
