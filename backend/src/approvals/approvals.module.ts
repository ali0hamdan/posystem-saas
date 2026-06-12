import { Module } from '@nestjs/common';
import { ApprovalIdModule } from '../users/approval-id.module';
import { RefundApprovalService } from './refund-approval.service';
import { ApprovalsController } from './approvals.controller';

@Module({
  imports: [ApprovalIdModule],
  controllers: [ApprovalsController],
  providers: [RefundApprovalService],
  exports: [RefundApprovalService],
})
export class ApprovalsModule {}
