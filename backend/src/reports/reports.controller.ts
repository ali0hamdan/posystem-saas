import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/types/safe-user.type';
import { ReportsService } from './reports.service';
import { CommercialReportsService } from './commercial-reports.service';
import {
  BestSellingQueryDto,
  CashierPerformanceQueryDto,
  DailySalesQueryDto,
  RefundsReportQueryDto,
  ReportsDateRangeQueryDto,
  ReportsPaginationQueryDto,
  CustomerPaymentHistoryQueryDto,
  GrossProfitByProductQueryDto,
  InventoryMovementsQueryDto,
  ProductExpiryReportQueryDto,
} from './dto/reports.query.dto';
import { BranchScopeService } from '../branch/branch-scope.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly commercialReports: CommercialReportsService,
    private readonly branchScope: BranchScopeService,
  ) {}

  @Get('dashboard')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async dashboard(@CurrentUser() user: SafeUser, @Headers('x-branch-id') branchHeader?: string) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, undefined);
    return this.reportsService.dashboard(user, branchId);
  }

  @Get('daily-sales')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async dailySales(
    @CurrentUser() user: SafeUser,
    @Query() query: DailySalesQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.reportsService.dailySales(user, query, branchId);
  }

  @Get('monthly-sales')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async monthlySales(
    @CurrentUser() user: SafeUser,
    @Query() query: ReportsDateRangeQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.reportsService.monthlySales(user, query, branchId);
  }

  @Get('profit')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async profit(
    @CurrentUser() user: SafeUser,
    @Query() query: ReportsDateRangeQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.reportsService.profit(user, query, branchId);
  }

  @Get('best-selling-products')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async bestSellingProducts(
    @CurrentUser() user: SafeUser,
    @Query() query: BestSellingQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.reportsService.bestSellingProducts(user, query, branchId);
  }

  @Get('low-stock')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async lowStock(
    @CurrentUser() user: SafeUser,
    @Query() query: ReportsPaginationQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.reportsService.lowStock(user, query, branchId);
  }

  @Get('stock-value')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async stockValue(@CurrentUser() user: SafeUser, @Headers('x-branch-id') branchHeader?: string) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, undefined);
    return this.reportsService.stockValue(user, branchId);
  }

  @Get('cashier-performance')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async cashierPerformance(
    @CurrentUser() user: SafeUser,
    @Query() query: CashierPerformanceQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.reportsService.cashierPerformance(user, query, branchId);
  }

  @Get('refunds')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async refunds(
    @CurrentUser() user: SafeUser,
    @Query() query: RefundsReportQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.reportsService.refunds(user, query, branchId);
  }

  @Get('customer-debts')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async customerDebts(
    @CurrentUser() user: SafeUser,
    @Query() query: ReportsPaginationQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.reportsService.customerDebts(user, query, branchId);
  }

  @Get('customer-credit/summary')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async customerCreditSummary(
    @CurrentUser() user: SafeUser,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, undefined);
    return this.reportsService.customerCreditSummary(user, branchId);
  }

  @Get('customer-payment-history')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async customerPaymentHistory(
    @CurrentUser() user: SafeUser,
    @Query() query: CustomerPaymentHistoryQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.reportsService.customerPaymentHistory(user, query, branchId);
  }

  // --- Commercial / POS-level reports (COGS from SaleItem.costPriceAtSale; refunds netted) ---

  @Get('sales-summary')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async salesSummary(
    @CurrentUser() user: SafeUser,
    @Query() query: ReportsDateRangeQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.commercialReports.salesSummary(user, query, branchId);
  }

  @Get('profit-and-loss')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async profitAndLoss(
    @CurrentUser() user: SafeUser,
    @Query() query: ReportsDateRangeQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.commercialReports.profitAndLoss(user, query, branchId);
  }

  @Get('gross-profit-by-product')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async grossProfitByProduct(
    @CurrentUser() user: SafeUser,
    @Query() query: GrossProfitByProductQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.commercialReports.grossProfitByProduct(user, query, branchId);
  }

  @Get('gross-profit-by-category')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async grossProfitByCategory(
    @CurrentUser() user: SafeUser,
    @Query() query: ReportsDateRangeQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.commercialReports.grossProfitByCategory(user, query, branchId);
  }

  @Get('payment-methods')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async paymentMethods(
    @CurrentUser() user: SafeUser,
    @Query() query: ReportsDateRangeQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.commercialReports.paymentMethods(user, query, branchId);
  }

  @Get('discounts')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async discountsReport(
    @CurrentUser() user: SafeUser,
    @Query() query: ReportsDateRangeQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.commercialReports.discountsReport(user, query, branchId);
  }

  @Get('stock-valuation')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async stockValuationDetailed(
    @CurrentUser() user: SafeUser,
    @Query() query: ReportsPaginationQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.commercialReports.stockValuationDetailed(user, query, branchId);
  }

  @Get('inventory-movements')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async inventoryMovements(
    @CurrentUser() user: SafeUser,
    @Query() query: InventoryMovementsQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.commercialReports.inventoryMovements(user, query, branchId);
  }

  @Get('products-expiry')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async productsExpiry(
    @CurrentUser() user: SafeUser,
    @Query() query: ProductExpiryReportQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.commercialReports.productsExpiry(user, query, branchId);
  }

  @Get('supplier-purchases')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async supplierPurchases(
    @CurrentUser() user: SafeUser,
    @Query() query: ReportsDateRangeQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.commercialReports.supplierPurchases(user, query, branchId);
  }

  @Get('shift-closing')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async shiftClosing(
    @CurrentUser() user: SafeUser,
    @Query() query: ReportsDateRangeQueryDto,
    @Headers('x-branch-id') branchHeader?: string,
  ) {
    const branchId = await this.branchScope.resolveBranchIdForReport(user, branchHeader, query.branchId);
    return this.commercialReports.shiftClosing(user, query, branchId);
  }

  @Get('branch-comparison')
  @Roles(UserRole.OWNER)
  async branchComparison(@CurrentUser() user: SafeUser, @Query() query: ReportsDateRangeQueryDto) {
    return this.commercialReports.branchComparison(user, query);
  }

  @Get('customer-debt-report')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  async customerDebtReport(@CurrentUser() user: SafeUser, @Query() query: ReportsPaginationQueryDto) {
    return this.commercialReports.customerDebtReport(user, query);
  }
}
