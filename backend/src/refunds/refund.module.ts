import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StockModule } from '../stock/stock.module';
import { CustomersModule } from '../customers/customers.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { ApprovalIdModule } from '../users/approval-id.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { SettingsModule } from '../settings/settings.module';
import { RefundService } from './refund.service';
import { RefundPrintService } from './refund-print.service';
import { RefundController } from './refund.controller';

@Module({
  imports: [
    AuthModule,
    StockModule,
    CustomersModule,
    CommissionsModule,
    ApprovalIdModule,
    ApprovalsModule,
    SettingsModule,
  ],
  controllers: [RefundController],
  providers: [RefundService, RefundPrintService],
  exports: [RefundService, RefundPrintService],
})
export class RefundsModule {}
