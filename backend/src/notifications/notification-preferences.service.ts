import { BadRequestException, Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ALL_NOTIFICATION_TYPES, NOTIFICATION_TYPE_META } from './notification-types';
import { UpdateNotificationPreferenceDto } from './dto/notification-preference.dto';

export interface NotificationPreferenceView {
  notificationType: NotificationType;
  label: string;
  description: string;
  enabled: boolean;
  sendToOwner: boolean;
  sendToGeneralManager: boolean;
  sendToCoManager: boolean;
  selectedUserIds: string[];
  isDefault: boolean;
}

@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** All notification types with stored overrides merged over built-in defaults. */
  async list(clientId: string): Promise<NotificationPreferenceView[]> {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { clientId },
    });
    const byType = new Map(rows.map((r) => [r.notificationType, r]));

    return ALL_NOTIFICATION_TYPES.map((type) => {
      const meta = NOTIFICATION_TYPE_META[type];
      const row = byType.get(type);
      return {
        notificationType: type,
        label: meta.label,
        description: meta.description,
        enabled: row?.enabled ?? meta.enabled,
        sendToOwner: row?.sendToOwner ?? meta.sendToOwner,
        sendToGeneralManager: row?.sendToGeneralManager ?? meta.sendToGeneralManager,
        sendToCoManager: row?.sendToCoManager ?? meta.sendToCoManager,
        selectedUserIds: Array.isArray(row?.selectedUserIds)
          ? (row.selectedUserIds as string[]).filter((v) => typeof v === 'string')
          : [],
        isDefault: !row,
      };
    });
  }

  async update(
    clientId: string,
    actorUserId: string,
    dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceView> {
    // Validate selected users belong to this client (tenant isolation).
    let selectedUserIds: string[] | undefined;
    if (dto.selectedUserIds !== undefined) {
      const unique = [...new Set(dto.selectedUserIds)];
      if (unique.length) {
        const count = await this.prisma.user.count({
          where: { id: { in: unique }, clientId },
        });
        if (count !== unique.length) {
          throw new BadRequestException({
            message: 'One or more selected users do not belong to this business',
            code: 'INVALID_RECIPIENT_USERS',
          });
        }
      }
      selectedUserIds = unique;
    }

    const meta = NOTIFICATION_TYPE_META[dto.notificationType];
    const existing = await this.prisma.notificationPreference.findUnique({
      where: {
        clientId_notificationType: { clientId, notificationType: dto.notificationType },
      },
    });

    const next = {
      enabled: dto.enabled ?? existing?.enabled ?? meta.enabled,
      sendToOwner: dto.sendToOwner ?? existing?.sendToOwner ?? meta.sendToOwner,
      sendToGeneralManager:
        dto.sendToGeneralManager ?? existing?.sendToGeneralManager ?? meta.sendToGeneralManager,
      sendToCoManager: dto.sendToCoManager ?? existing?.sendToCoManager ?? meta.sendToCoManager,
      selectedUserIds:
        selectedUserIds ??
        (Array.isArray(existing?.selectedUserIds) ? (existing.selectedUserIds as string[]) : []),
    };

    const row = await this.prisma.notificationPreference.upsert({
      where: {
        clientId_notificationType: { clientId, notificationType: dto.notificationType },
      },
      create: {
        clientId,
        notificationType: dto.notificationType,
        ...next,
        selectedUserIds: next.selectedUserIds as Prisma.InputJsonValue,
      },
      update: {
        ...next,
        selectedUserIds: next.selectedUserIds as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      clientId,
      action: 'notifications.preferences.update',
      entity: 'NotificationPreference',
      entityId: row.id,
      newValue: {
        notificationType: dto.notificationType,
        enabled: row.enabled,
        sendToOwner: row.sendToOwner,
        sendToGeneralManager: row.sendToGeneralManager,
        sendToCoManager: row.sendToCoManager,
      },
    });

    return {
      notificationType: dto.notificationType,
      label: meta.label,
      description: meta.description,
      enabled: row.enabled,
      sendToOwner: row.sendToOwner,
      sendToGeneralManager: row.sendToGeneralManager,
      sendToCoManager: row.sendToCoManager,
      selectedUserIds: next.selectedUserIds,
      isDefault: false,
    };
  }
}
