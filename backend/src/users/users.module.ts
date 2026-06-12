import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../audit/audit-log.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { SalesmanIdModule } from './salesman-id.module';
import { ApprovalIdModule } from './approval-id.module';
import { NfcCardService } from './nfc-card.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, PrismaModule, AuditLogModule, CommissionsModule, SalesmanIdModule, ApprovalIdModule],
  controllers: [UsersController],
  providers: [UsersService, NfcCardService],
  exports: [SalesmanIdModule, ApprovalIdModule],
})
export class UsersModule {}
