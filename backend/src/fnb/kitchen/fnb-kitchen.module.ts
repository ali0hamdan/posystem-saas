import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { FnbKitchenService } from './kitchen.service';
import { FnbKitchenController } from './kitchen.controller';

@Module({
  imports: [AuthModule],
  controllers: [FnbKitchenController],
  providers: [FnbKitchenService],
  exports: [FnbKitchenService],
})
export class FnbKitchenModule {}
