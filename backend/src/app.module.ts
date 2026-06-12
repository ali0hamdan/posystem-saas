import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import monitoringConfig from './config/monitoring.config';
import jwtConfig from './config/jwt.config';
import saasJwtConfig from './config/saas-jwt.config';
import licenseConfig from './config/license.config';
import throttleConfig from './config/throttle.config';
import securityConfig from './config/security.config';
import { envValidationSchema } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LicenseGuard } from './license/license.guard';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { AuditLogModule } from './audit/audit-log.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { StockModule } from './stock/stock.module';
import { SalesModule } from './sales/sales.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { ShiftsModule } from './shifts/shifts.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { SettingsModule } from './settings/settings.module';
import { BranchesModule } from './branches/branches.module';
import { StockTransfersModule } from './stock-transfers/stock-transfers.module';
import { CustomersModule } from './customers/customers.module';
import { LicenseModule } from './license/license.module';
import { TenantModule } from './tenant/tenant.module';
import { FeatureModule } from './fnb/feature/feature.module';
import { FnbTablesModule } from './fnb/tables/fnb-tables.module';
import { FnbMenuModule } from './fnb/menu/fnb-menu.module';
import { FnbOrdersModule } from './fnb/orders/fnb-orders.module';
import { FnbKitchenModule } from './fnb/kitchen/fnb-kitchen.module';
import { FnbRecipesModule } from './fnb/recipes/fnb-recipes.module';
import { FnbReservationsModule } from './fnb/reservations/fnb-reservations.module';
import { FnbReportsModule } from './fnb/reports/fnb-reports.module';
import { WasteModule } from './fnb/waste/waste.module';
import { DeliveryModule } from './fnb/delivery/delivery.module';
import { IngredientsModule } from './fnb/ingredients/ingredients.module';
import { SaasAuthModule } from './saas/saas-auth.module';
import { ActivationModule } from './activation/activation.module';
import { CouponsModule } from './coupons/coupons.module';
import { PublicModule } from './public/public.module';
import { CommonModule } from './common/common.module';
import { SubscriptionEnforcementInterceptor } from './common/interceptors/subscription-enforcement.interceptor';
import { QuotationsModule } from './quotations/quotations.module';
import { ProformaInvoicesModule } from './proforma-invoices/proforma-invoices.module';
import { WholesaleModule } from './wholesale/wholesale.module';
import { EmailModule } from './email/email.module';
import { NotificationModule } from './notifications/notification.module';
import { RefundsModule } from './refunds/refund.module';
import { PermissionsModule } from './permissions/permissions.module';
import { CommissionsModule } from './commissions/commissions.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { DesktopModule } from './desktop/desktop.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        configuration,
        jwtConfig,
        saasJwtConfig,
        licenseConfig,
        throttleConfig,
        securityConfig,
        monitoringConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
        convert: true,
      },
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('app.nodeEnv') ?? 'development';
        const isProd = nodeEnv === 'production';
        const configured = config.get<string | null>('monitoring.logLevel');
        const level =
          configured && configured.trim()
            ? configured.trim()
            : isProd
              ? 'info'
              : 'debug';
        return {
          pinoHttp: {
            level,
            genReqId: (req: { headers: Record<string, string | string[] | undefined> }) => {
              const raw = req.headers['x-request-id'];
              if (typeof raw === 'string' && raw.trim().length > 0) {
                return raw.trim().slice(0, 128);
              }
              if (Array.isArray(raw) && raw[0]?.trim()) {
                return raw[0].trim().slice(0, 128);
              }
              return randomUUID();
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers["x-license-token"]',
                'req.headers.cookie',
              ],
              remove: true,
            },
            serializers: {
              req(req: { id?: string; method: string; url: string }) {
                return { id: req.id, method: req.method, url: req.url };
              },
              res(res: { statusCode: number }) {
                return { statusCode: res.statusCode };
              },
            },
            customLogLevel: (
              _req: unknown,
              res: { statusCode: number },
              err: unknown,
            ): 'error' | 'warn' | 'info' | 'debug' => {
              if (res.statusCode >= 500 || err) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttlMs') ?? 60_000,
            limit: config.get<number>('throttle.limit') ?? 200,
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EmailModule,
    NotificationModule,
    CommonModule,
    FeatureModule,
    FnbTablesModule,
    FnbMenuModule,
    FnbOrdersModule,
    FnbKitchenModule,
    FnbRecipesModule,
    FnbReservationsModule,
    FnbReportsModule,
    WasteModule,
    DeliveryModule,
    IngredientsModule,
    TenantModule,
    HealthModule,
    AuthModule,
    SaasAuthModule,
    AdminModule,
    AuditLogModule,
    CategoriesModule,
    ProductsModule,
    StockModule,
    SalesModule,
    RefundsModule,
    PermissionsModule,
    SuppliersModule,
    PurchaseOrdersModule,
    ShiftsModule,
    ExpensesModule,
    ReportsModule,
    UsersModule,
    SettingsModule,
    BranchesModule,
    StockTransfersModule,
    CustomersModule,
    LicenseModule,
    ActivationModule,
    CouponsModule,
    PublicModule,
    QuotationsModule,
    ProformaInvoicesModule,
    WholesaleModule,
    CommissionsModule,
    ApprovalsModule,
    DesktopModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: LicenseGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SubscriptionEnforcementInterceptor,
    },
  ],
})
export class AppModule {}
