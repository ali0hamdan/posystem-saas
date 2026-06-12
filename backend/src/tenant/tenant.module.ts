import { Global, Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';

@Global()
@Module({
  controllers: [TenantController],
})
export class TenantModule {}
