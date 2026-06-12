import { Module } from '@nestjs/common';
import { ApprovalIdService } from './approval-id.service';

@Module({
  providers: [ApprovalIdService],
  exports: [ApprovalIdService],
})
export class ApprovalIdModule {}
