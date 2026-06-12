import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PermissionsService } from './permissions.service';
import { PermissionsInterceptor } from './permissions.interceptor';
import { PermissionsController } from './permissions.controller';

@Global()
@Module({
  controllers: [PermissionsController],
  providers: [
    PermissionsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: PermissionsInterceptor,
    },
  ],
  exports: [PermissionsService],
})
export class PermissionsModule {}
