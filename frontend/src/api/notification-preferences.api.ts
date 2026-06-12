import { api } from '@/api/client';

export type NotificationType =
  | 'LOW_STOCK'
  | 'PASSWORD_RESET'
  | 'PURCHASE_COMPLETED'
  | 'SUBSCRIPTION_EXPIRING_48H'
  | 'SUBSCRIPTION_EXPIRING_24H'
  | 'WELCOME_MESSAGE'
  | 'USER_CREATED'
  | 'STOCK_ADDED'
  | 'SUBSCRIPTION_RENEWED_INVOICE'
  | 'PAYMENT_RECEIVED'
  | 'CUSTOMER_OVERDUE'
  | 'OFFICIAL_INVOICE_CREATED'
  | 'DEVICE_ACTIVATED'
  | 'LARGE_STOCK_ADJUSTMENT'
  | 'QUOTATION_ACCEPTED';

export interface NotificationPreference {
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

export interface UpdateNotificationPreferenceBody {
  notificationType: NotificationType;
  enabled?: boolean;
  sendToOwner?: boolean;
  sendToGeneralManager?: boolean;
  sendToCoManager?: boolean;
  selectedUserIds?: string[];
}

export async function fetchNotificationPreferences(): Promise<NotificationPreference[]> {
  const { data } = await api.get<NotificationPreference[]>('/settings/notifications');
  return data;
}

export async function updateNotificationPreference(
  body: UpdateNotificationPreferenceBody,
): Promise<NotificationPreference> {
  const { data } = await api.patch<NotificationPreference>('/settings/notifications', body);
  return data;
}
