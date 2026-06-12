import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/types/safe-user.type';
import { RefundApprovalService } from './refund-approval.service';
import { ValidateApprovalDto } from './dto/validate-approval.dto';

@Controller('approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
  constructor(private readonly refundApproval: RefundApprovalService) {}

  @Post('validate')
  validate(@Body() dto: ValidateApprovalDto, @CurrentUser() user: SafeUser) {
    return this.refundApproval.validateApproval(user.clientId, dto);
  }
}
