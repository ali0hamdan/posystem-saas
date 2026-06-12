import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser } from '../auth/types/safe-user.type';
import { REFUND_APPROVAL_ROLES } from './approval-id.service';
import {
  assertValidApprovalPin,
  assertValidNfcCardUid,
  hashApprovalPin,
  maskNfcCardUid,
} from '../common/utils/nfc-approval.util';

const MANAGER_SELECT = {
  id: true,
  name: true,
  username: true,
  role: true,
  isActive: true,
  nfcEnabled: true,
  nfcCardUid: true,
  approvalIdCode: true,
} as const;

@Injectable()
export class NfcCardService {
  constructor(private readonly prisma: PrismaService) {}

  private assertOwner(actor: SafeUser): void {
    if (actor.role !== UserRole.OWNER) {
      throw new ForbiddenException({
        message: 'Only the owner can manage NFC cards',
        code: 'NFC_MANAGE_FORBIDDEN',
      });
    }
  }

  private async getManagerOrThrow(actor: SafeUser, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, clientId: actor.clientId },
    });
    if (!user) {
      throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }
    if (!REFUND_APPROVAL_ROLES.includes(user.role)) {
      throw new BadRequestException({
        message: 'NFC approval is only available for general managers and co-managers',
        code: 'NOT_APPROVAL_ROLE',
      });
    }
    return user;
  }

  private sanitizeManager(user: {
    id: string;
    name: string;
    username: string;
    role: UserRole;
    isActive: boolean;
    nfcEnabled: boolean;
    nfcCardUid: string | null;
    approvalIdCode: string | null;
  }) {
    return {
      ...user,
      nfcCardUid: undefined,
      nfcCardRegistered: Boolean(user.nfcCardUid),
      nfcCardMasked: user.nfcCardUid ? maskNfcCardUid(user.nfcCardUid) : null,
    };
  }

  async registerNfcCard(actor: SafeUser, userId: string, nfcCardUidRaw: string) {
    this.assertOwner(actor);
    const target = await this.getManagerOrThrow(actor, userId);
    const uid = assertValidNfcCardUid(nfcCardUidRaw);

    const duplicate = await this.prisma.user.findFirst({
      where: {
        clientId: actor.clientId,
        nfcCardUid: uid,
        NOT: { id: userId },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({
        message: 'This NFC card is already registered to another user',
        code: 'NFC_UID_DUPLICATE',
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { nfcCardUid: uid, nfcEnabled: true },
      select: MANAGER_SELECT,
    });
    return this.sanitizeManager(updated);
  }

  async removeNfcCard(actor: SafeUser, userId: string) {
    this.assertOwner(actor);
    await this.getManagerOrThrow(actor, userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { nfcCardUid: null, nfcEnabled: false },
      select: MANAGER_SELECT,
    });
    return this.sanitizeManager(updated);
  }

  async setNfcEnabled(actor: SafeUser, userId: string, nfcEnabled: boolean) {
    this.assertOwner(actor);
    const target = await this.getManagerOrThrow(actor, userId);
    if (nfcEnabled && !target.nfcCardUid) {
      throw new BadRequestException({
        message: 'Register an NFC card before enabling NFC approval',
        code: 'NFC_NOT_REGISTERED',
      });
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { nfcEnabled },
      select: MANAGER_SELECT,
    });
    return this.sanitizeManager(updated);
  }

  async setApprovalPin(actor: SafeUser, userId: string, pinRaw: string) {
    const target = await this.getManagerOrThrow(actor, userId);
    const canSetPin =
      actor.role === UserRole.OWNER ||
      (actor.id === target.id && REFUND_APPROVAL_ROLES.includes(actor.role));
    if (!canSetPin) {
      throw new ForbiddenException({
        message: 'You do not have permission to set this approval PIN',
        code: 'APPROVAL_PIN_FORBIDDEN',
      });
    }

    const pin = assertValidApprovalPin(pinRaw);
    const approvalPinHash = await hashApprovalPin(pin);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { approvalPinHash },
      select: MANAGER_SELECT,
    });
    return this.sanitizeManager(updated);
  }
}
