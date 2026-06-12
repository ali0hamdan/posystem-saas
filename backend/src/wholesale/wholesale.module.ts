import { Module } from '@nestjs/common';
import { FeatureModule } from '../fnb/feature/feature.module';
import { SettingsModule } from '../settings/settings.module';
import { CommonModule } from '../common/common.module';
import { WholesaleReportsController } from './reports/wholesale-reports.controller';
import { WholesaleReportsService } from './reports/wholesale-reports.service';
import { WholesaleScopeService } from './wholesale-scope.service';
import { StockReservationsController } from './stock-reservations/stock-reservations.controller';
import { StockReservationsService } from './stock-reservations/stock-reservations.service';
import { PriceListsController } from './price-lists/price-lists.controller';
import { PriceListsService } from './price-lists/price-lists.service';
import { DeliveryNotesController } from './delivery-notes/delivery-notes.controller';
import { DeliveryNotesService } from './delivery-notes/delivery-notes.service';
import { CustomerCreditController } from './customer-credit/customer-credit.controller';
import { CustomerCreditService } from './customer-credit/customer-credit.service';
import { ApprovalsController } from './approvals/approvals.controller';
import { ApprovalsService } from './approvals/approvals.service';
import { B2bPrintController } from './print/b2b-print.controller';
import { B2bPrintService } from './print/b2b-print.service';
import { BranchScopeService } from '../branch/branch-scope.service';
import { BulkPricingController } from './bulk-pricing/bulk-pricing.controller';
import { BulkPricingService } from './bulk-pricing/bulk-pricing.service';
import { WholesalePricingService } from './bulk-pricing/wholesale-pricing.service';

@Module({
  imports: [FeatureModule, SettingsModule, CommonModule],
  controllers: [
    WholesaleReportsController,
    StockReservationsController,
    PriceListsController,
    DeliveryNotesController,
    CustomerCreditController,
    ApprovalsController,
    B2bPrintController,
    BulkPricingController,
  ],
  providers: [
    WholesaleReportsService,
    WholesaleScopeService,
    StockReservationsService,
    PriceListsService,
    DeliveryNotesService,
    CustomerCreditService,
    ApprovalsService,
    B2bPrintService,
    BranchScopeService,
    BulkPricingService,
    WholesalePricingService,
  ],
  exports: [WholesaleScopeService, WholesaleReportsService, WholesalePricingService],
})
export class WholesaleModule {}
