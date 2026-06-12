import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StockModule } from '../stock/stock.module';
import { SettingsModule } from '../settings/settings.module';
import { CustomersModule } from '../customers/customers.module';
import { RefundsModule } from '../refunds/refund.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { BranchScopeService } from '../branch/branch-scope.service';

@Module({
  imports: [
    AuthModule,
    StockModule,
    SettingsModule,
    CustomersModule,
    RefundsModule,
    CommissionsModule,
  ],
  controllers: [SalesController],
  providers: [SalesService, BranchScopeService],
  exports: [SalesService],
})
export class SalesModule {}