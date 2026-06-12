import { NotificationType, UserRole } from '@prisma/client';

export interface NotificationDefaults {
  enabled: boolean;
  sendToOwner: boolean;
  sendToGeneralManager: boolean;
  sendToCoManager: boolean;
}

export interface NotificationTypeMeta extends NotificationDefaults {
  label: string;
  description: string;
}

/**
 * Default recipient configuration applied when a client has not customized a
 * notification type. The OWNER can override each of these from the
 * Notification Settings page.
 */
export const NOTIFICATION_TYPE_META: Record<NotificationType, NotificationTypeMeta> = {
  [NotificationType.LOW_STOCK]: {
    label: 'Low stock alert',
    description: 'A product or ingredient dropped to or below its low-stock level.',
    enabled: true,
    sendToOwner: true,
    sendToGeneralManager: true,
    sendToCoManager: true,
  },
  [NotificationType.PASSWORD_RESET]: {
    label: 'Password reset completed',
    description: 'A user in your business completed a password reset.',
    enabled: true,
    sendToOwner: true,
    sendToGeneralManager: false,
    sendToCoManager: false,
  },
  [NotificationType.PURCHASE_COMPLETED]: {
    label: 'Purchase completed',
    description: 'A sale, F&B order, or official invoice was completed.',
    enabled: true,
    sendToOwner: true,
    sendToGeneralManager: true,
    sendToCoManager: false,
  },
  [NotificationType.SUBSCRIPTION_EXPIRING_48H]: {
    label: 'Subscription expiring (48 hours)',
    description: 'Your subscription expires in 48 hours.',
    enabled: true,
    sendToOwner: true,
    sendToGeneralManager: true,
    sendToCoManager: false,
  },
  [NotificationType.SUBSCRIPTION_EXPIRING_24H]: {
    label: 'Subscription expiring (24 hours)',
    description: 'Your subscription expires in 24 hours.',
    enabled: true,
    sendToOwner: true,
    sendToGeneralManager: true,
    sendToCoManager: false,
  },
  [NotificationType.WELCOME_MESSAGE]: {
    label: 'Welcome message',
    description: 'Sent once after the first successful subscription payment.',
    enabled: true,
    sendToOwner: true,
    sendToGeneralManager: false,
    sendToCoManager: false,
  },
  [NotificationType.USER_CREATED]: {
    label: 'New user added',
    description: 'A new user account was created in your business.',
    enabled: true,
    sendToOwner: true,
    sendToGeneralManager: true,
    sendToCoManager: false,
  },
  [NotificationType.STOCK_ADDED]: {
    label: 'Stock added',
    description: 'Stock was increased by a purchase, adjustment, or import.',
    enabled: true,
    sendToOwner: true,
    sendToGeneralManager: true,
    sendToCoManager: false,
  },
  [NotificationType.SUBSCRIPTION_RENEWED_INVOICE]: {
    label: 'Subscription renewed (invoice)',
    description: 'Receipt for a successful subscription renewal.',
    enabled: true,
    sendToOwner: true,
    sendToGeneralManager: false,
    sendToCoManager: false,
  },
  [NotificationType.PAYMENT_RECEIVED]: {
    label: 'Payment received',
    description: 'A customer payment was recorded.',
    enabled: false,
    sendToOwner: true,
    sendToGeneralManager: true,
    sendToCoManager: false,
  },
  [NotificationType.CUSTOMER_OVERDUE]: {
    label: 'Customer payment overdue',
    description: 'A customer balance is past its payment terms.',
    enabled: false,
    sendToOwner: true,
    sendToGeneralManager: true,
    sendToCoManager: false,
  },
  [NotificationType.OFFICIAL_INVOICE_CREATED]: {
    label: 'Official invoice created',
    description: 'A new official B2B invoice was issued.',
    enabled: false,
    sendToOwner: true,
    sendToGeneralManager: true,
    sendToCoManager: false,
  },
  [NotificationType.DEVICE_ACTIVATED]: {
    label: 'Device activated',
    description: 'A new device or activation code was used.',
    enabled: true,
    sendToOwner: true,
    sendToGeneralManager: false,
    sendToCoManager: false,
  },
  [NotificationType.LARGE_STOCK_ADJUSTMENT]: {
    label: 'Large stock adjustment',
    description: 'A significant manual stock adjustment was made.',
    enabled: false,
    sendToOwner: true,
    sendToGeneralManager: true,
    sendToCoManager: false,
  },
  [NotificationType.QUOTATION_ACCEPTED]: {
    label: 'Quotation accepted',
    description: 'A customer accepted a quotation.',
    enabled: true,
    sendToOwner: true,
    sendToGeneralManager: true,
    sendToCoManager: false,
  },
  [NotificationType.REFUND_COMPLETED]: {
    label: 'Refund completed',
    description: 'A refund was processed for a sale, order, or invoice.',
    enabled: true,
    sendToOwner: true,
    sendToGeneralManager: true,
    sendToCoManager: false,
  },
  [NotificationType.COMMISSION_APPROVED]: {
    label: 'Commission approved',
    description: 'A salesman commission was approved for payment.',
    enabled: true,
    sendToOwner: true,
    sendToGeneralManager: true,
    sendToCoManager: false,
  },
  [NotificationType.COMMISSION_PAID]: {
    label: 'Commission paid',
    description: 'A salesman commission was marked as paid.',
    enabled: true,
    sendToOwner: false,
    sendToGeneralManager: true,
    sendToCoManager: false,
  },
};

export const ALL_NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_META) as NotificationType[];

/** Roles matched by the "General Manager" recipient toggle (legacy ADMIN included). */
export const GENERAL_MANAGER_ROLES: UserRole[] = [UserRole.GENERAL_MANAGER, UserRole.ADMIN];

/** Roles matched by the "Co-Manager" recipient toggle (legacy MANAGER included). */
export const CO_MANAGER_ROLES: UserRole[] = [UserRole.CO_MANAGER, UserRole.MANAGER];
