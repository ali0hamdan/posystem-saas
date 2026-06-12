import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../audit/audit-log.module';
import { NotificationService } from './notification.service';
import { NotificationRecipientService } from './notification-recipient.service';
import { NotificationCronService } from './notification-cron.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { CustomerOverdueService } from './customer-overdue.service';

@Global()
@Module({
  imports: [AuthModule, AuditLogModule],
  controllers: [NotificationPreferencesController],
  providers: [
    NotificationService,
    NotificationRecipientService,
    NotificationCronService,
    NotificationPreferencesService,
    CustomerOverdueService,
  ],
  exports: [NotificationService, NotificationRecipientService, CustomerOverdueService],
})
export class NotificationModule {}
