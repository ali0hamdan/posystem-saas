import { Injectable } from '@nestjs/common';
import { NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CO_MANAGER_ROLES,
  GENERAL_MANAGER_ROLES,
  NOTIFICATION_TYPE_META,
  NotificationDefaults,
} from './notification-types';

export interface NotificationRecipient {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface ResolvedPreference extends NotificationDefaults {
  notificationType: NotificationType;
  selectedUserIds: string[];
}

@Injectable()
export class NotificationRecipientService {
  constructor(private readonly prisma: PrismaService) {}

  /** Effective preference for a client + type: stored override or built-in default. */
  async getPreference(
    clientId: string,
    notificationType: NotificationType,
  ): Promise<ResolvedPreference> {
    const row = await this.prisma.notificationPreference.findUnique({
      where: { clientId_notificationType: { clientId, notificationType } },
    });
    const defaults = NOTIFICATION_TYPE_META[notificationType];
    if (!row) {
      return { notificationType, ...defaults, selectedUserIds: [] };
    }
    return {
      notificationType,
      enabled: row.enabled,
      sendToOwner: row.sendToOwner,
      sendToGeneralManager: row.sendToGeneralManager,
      sendToCoManager: row.sendToCoManager,
      selectedUserIds: Array.isArray(row.selectedUserIds)
        ? (row.selectedUserIds as string[]).filter((v) => typeof v === 'string')
        : [],
    };
  }

  /**
   * Resolve the de-duplicated list of users who should receive a notification.
   * Always scoped to the client; only active users with verified emails.
   */
  async getRecipients(
    clientId: string,
    notificationType: NotificationType,
  ): Promise<NotificationRecipient[]> {
    const settings = await this.prisma.storeSettings.findUnique({
      where: { clientId },
      select: { emailNotificationsEnabled: true },
    });
    if (settings && !settings.emailNotificationsEnabled) return [];

    const pref = await this.getPreference(clientId, notificationType);
    if (!pref.enabled) return [];

    const roles: UserRole[] = [];
    if (pref.sendToOwner) roles.push(UserRole.OWNER);
    if (pref.sendToGeneralManager) roles.push(...GENERAL_MANAGER_ROLES);
    if (pref.sendToCoManager) roles.push(...CO_MANAGER_ROLES);

    if (!roles.length && !pref.selectedUserIds.length) return [];

    const orConditions: { role?: { in: UserRole[] }; id?: { in: string[] } }[] = [];
    if (roles.length) orConditions.push({ role: { in: roles } });
    if (pref.selectedUserIds.length) orConditions.push({ id: { in: pref.selectedUserIds } });

    const users = await this.prisma.user.findMany({
      where: {
        clientId,
        isActive: true,
        email: { not: null },
        emailVerified: true,
        OR: orConditions,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    const seen = new Set<string>();
    const recipients: NotificationRecipient[] = [];
    for (const u of users) {
      if (!u.email) continue;
      const key = u.email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      recipients.push({ id: u.id, email: u.email, name: u.name, role: u.role });
    }
    return recipients;
  }
}
