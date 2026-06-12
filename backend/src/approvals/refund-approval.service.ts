import { BadRequestException, Injectable } from '@nestjs/common';
import { RefundApprovalMethod, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalIdService, REFUND_APPROVAL_ROLES } from '../users/approval-id.service';
import {
  assertValidApprovalPin,
  assertValidNfcCardUid,
  hashNfcCardUid,
  maskNfcCardUid,
  verifyApprovalPin,
} from '../common/utils/nfc-approval.util';
import { ValidateApprovalDto } from './dto/validate-approval.dto';
import { RefundApprovalInputDto } from '../refunds/dto/refund.dto';

export type RefundApproverResult = {
  id: string;
  name: string;
  role: string;
  approvalIdCode: string | null;
  approvalMethod: RefundApprovalMethod;
  approvedByApprovalIdCodeSnapshot: string | null;
  approvedByNfcUidHashSnapshot: string | null;
  approvedByNfcUidMaskedSnapshot: string | null;
};

type ApproverUser = {
  id: string;
  name: string;
  role: UserRole;
  approvalIdCode: string | null;
  nfcCardUid?: string | null;
  nfcEnabled?: boolean;
  approvalPinHash?: string | null;
  isActive: boolean;
};

@Injectable()
export class RefundApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalId: ApprovalIdService,
  ) {}

  async getRefundApprovalMethod(clientId: string): Promise<RefundApprovalMethod> {
    const settings = await this.prisma.storeSettings.findUnique({
      where: { clientId },
      select: { refundApprovalMethod: true },
    });
    return settings?.refundApprovalMethod ?? RefundApprovalMethod.APPROVAL_ID;
  }

  async validateApproval(clientId: string, dto: ValidateApprovalDto) {
    const method = dto.method ?? (await this.getRefundApprovalMethod(clientId));
    const approver = await this.resolveApprover(clientId, method, dto);
    return {
      valid: true as const,
      approver: {
        id: approver.id,
        name: approver.name,
        role: approver.role,
      },
    };
  }

  async validateForRefund(clientId: string, dto: RefundApprovalInputDto): Promise<RefundApproverResult> {
    const method = await this.getRefundApprovalMethod(clientId);
    const approver = await this.resolveApprover(clientId, method, dto);
    return this.toResult(clientId, method, approver, dto);
  }

  private async resolveApprover(
    clientId: string,
    method: RefundApprovalMethod,
    dto: RefundApprovalInputDto,
  ): Promise<ApproverUser> {
    switch (method) {
      case RefundApprovalMethod.APPROVAL_ID:
        return this.approvalId.validateApproverForRefund(clientId, dto.approvalIdCode);
      case RefundApprovalMethod.NFC_CARD:
        return this.validateNfcApprover(clientId, dto.nfcCardUid);
      case RefundApprovalMethod.NFC_CARD_AND_PIN:
        return this.validateNfcApprover(clientId, dto.nfcCardUid, dto.approvalPin ?? '');
      default:
        throw new BadRequestException({
          message: 'Unsupported refund approval method.',
          code: 'UNSUPPORTED_APPROVAL_METHOD',
        });
    }
  }

  private async validateNfcApprover(
    clientId: string,
    nfcCardUidRaw: string | undefined,
    approvalPinRaw?: string,
  ): Promise<ApproverUser> {
    if (!nfcCardUidRaw?.trim()) {
      throw new BadRequestException({
        message: 'NFC card is required.',
        code: 'NFC_CARD_REQUIRED',
      });
    }

    const uid = assertValidNfcCardUid(nfcCardUidRaw);
    const user = await this.prisma.user.findFirst({
      where: { clientId, nfcCardUid: uid },
      select: {
        id: true,
        name: true,
        role: true,
        approvalIdCode: true,
        nfcCardUid: true,
        nfcEnabled: true,
        approvalPinHash: true,
        isActive: true,
      },
    });

    if (!user?.nfcCardUid) {
      throw new BadRequestException({
        message: 'Invalid NFC card.',
        code: 'INVALID_NFC_CARD',
      });
    }

    if (!user.isActive) {
      throw new BadRequestException({
        message: 'This manager is inactive.',
        code: 'APPROVAL_MANAGER_INACTIVE',
      });
    }

    if (!REFUND_APPROVAL_ROLES.includes(user.role)) {
      throw new BadRequestException({
        message: 'This NFC card is not authorized for refunds.',
        code: 'NFC_NOT_AUTHORIZED',
      });
    }

    if (!user.nfcEnabled) {
      throw new BadRequestException({
        message: 'This NFC card is not authorized for refunds.',
        code: 'NFC_NOT_ENABLED',
      });
    }

    if (approvalPinRaw !== undefined) {
      if (!approvalPinRaw.trim()) {
        throw new BadRequestException({
          message: 'Approval PIN is required.',
          code: 'APPROVAL_PIN_REQUIRED',
        });
      }
      const pin = assertValidApprovalPin(approvalPinRaw);
      if (!user.approvalPinHash) {
        throw new BadRequestException({
          message: 'Approval PIN is required.',
          code: 'APPROVAL_PIN_NOT_SET',
        });
      }
      const ok = await verifyApprovalPin(pin, user.approvalPinHash);
      if (!ok) {
        throw new BadRequestException({
          message: 'Invalid PIN.',
          code: 'INVALID_APPROVAL_PIN',
        });
      }
    }

    return user;
  }

  private toResult(
    clientId: string,
    method: RefundApprovalMethod,
    approver: ApproverUser,
    dto: RefundApprovalInputDto,
  ): RefundApproverResult {
    if (method === RefundApprovalMethod.APPROVAL_ID) {
      return {
        id: approver.id,
        name: approver.name,
        role: approver.role,
        approvalIdCode: approver.approvalIdCode,
        approvalMethod: method,
        approvedByApprovalIdCodeSnapshot: approver.approvalIdCode,
        approvedByNfcUidHashSnapshot: null,
        approvedByNfcUidMaskedSnapshot: null,
      };
    }

    const uid = assertValidNfcCardUid(dto.nfcCardUid);
    return {
      id: approver.id,
      name: approver.name,
      role: approver.role,
      approvalIdCode: approver.approvalIdCode,
      approvalMethod: method,
      approvedByApprovalIdCodeSnapshot: null,
      approvedByNfcUidHashSnapshot: hashNfcCardUid(clientId, uid),
      approvedByNfcUidMaskedSnapshot: maskNfcCardUid(uid),
    };
  }
}
