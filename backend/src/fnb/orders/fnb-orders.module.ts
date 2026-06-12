import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SettingsModule } from '../../settings/settings.module';
import { StockModule } from '../../stock/stock.module';
import { RefundsModule } from '../../refunds/refund.module';
import { FnbOrdersService } from './orders.service';
import { FnbOrdersController } from './orders.controller';

@Module({
  imports: [AuthModule, SettingsModule, StockModule, RefundsModule],
  controllers: [FnbOrdersController],
  providers: [FnbOrdersService],
  exports: [FnbOrdersService],
})
export class FnbOrdersModule {}
