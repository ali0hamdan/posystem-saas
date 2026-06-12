import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalesModule } from '../sales/sales.module';
import { SettingsModule } from '../settings/settings.module';
import { WholesaleModule } from '../wholesale/wholesale.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { QuotationReportsController } from './quotation-reports.controller';

@Module({
  imports: [AuthModule, SalesModule, SettingsModule, WholesaleModule, CommissionsModule],
  controllers: [QuotationsController, QuotationReportsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
