import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureService } from '../../fnb/feature/feature.service';
import { WholesaleScopeService } from '../wholesale-scope.service';
import { DecideApprovalDto } from './dto/approval.dto';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: WholesaleScopeService,
    private readonly features: FeatureService,
  ) {}

  async listPending(clientId: string) {
    await this.scope.assertWholesaleBusiness(clientId);
    await this.features.assertFeature(clientId, 'approval_workflow');
    return this.prisma.approvalRequest.findMany({
      where: { clientId, status: ApprovalRequestStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string, dto: DecideApprovalDto, user: SafeUser) {
    return this.decide(id, ApprovalRequestStatus.APPROVED, dto, user);
  }

  async reject(id: string, dto: DecideApprovalDto, user: SafeUser) {
    return this.decide(id, ApprovalRequestStatus.REJECTED, dto, user);
  }

  private async decide(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    dto: DecideApprovalDto,
    user: SafeUser,
  ) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    await this.features.assertFeature(user.clientId, 'approval_workflow');
    const row = await this.prisma.approvalRequest.findFirst({
      where: { id, clientId: user.clientId },
    });
    if (!row) throw new NotFoundException('Approval request not found');
    if (row.status !== ApprovalRequestStatus.PENDING) {
      throw new BadRequestException({ message: 'Request already decided', code: 'INVALID_STATUS' });
    }
    return this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status,
        approvedById: user.id,
        reason: dto.reason?.trim() || null,
      },
    });
  }
}
