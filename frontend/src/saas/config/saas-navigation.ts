import {
  Building2,
  ClipboardList,
  Clock,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  Monitor,
  Settings,
  ShieldAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { SaasAdminRole } from '@/saas/types';
import { saasPath } from '@/saas/config/saas-paths';

export type SaasNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: SaasAdminRole[];
  end?: boolean;
};

export type SaasNavSection = {
  id: string;
  label: string;
  items: SaasNavItem[];
};

export const saasNavSections: SaasNavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ to: saasPath('/dashboard'), label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'clients',
    label: 'Clients',
    items: [
      { to: saasPath('/clients'), label: 'All clients', icon: Building2, end: true },
      { to: saasPath('/clients/pending'), label: 'Pending payment', icon: Clock },
      { to: saasPath('/clients/expiring'), label: 'Expiring soon', icon: ShieldAlert },
      { to: saasPath('/clients/suspended'), label: 'Suspended', icon: Users },
    ],
  },
  {
    id: 'licensing',
    label: 'Licensing',
    items: [
      { to: saasPath('/plans'), label: 'Plans', icon: CreditCard, roles: ['SUPER_ADMIN', 'SUPPORT', 'BILLING'] },
      { to: saasPath('/subscriptions'), label: 'Subscriptions', icon: ClipboardList },
      { to: saasPath('/activation-codes'), label: 'Activation codes', icon: KeyRound },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { to: saasPath('/devices'), label: 'Devices', icon: Monitor },
      { to: saasPath('/audit-logs'), label: 'Audit logs', icon: ClipboardList },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [{ to: saasPath('/settings'), label: 'Platform settings', icon: Settings, roles: ['SUPER_ADMIN'] }],
  },
];

export function saasNavVisible(role: SaasAdminRole | undefined, item: SaasNavItem): boolean {
  if (!item.roles) return true;
  if (!role) return false;
  return item.roles.includes(role);
}

export function visibleSaasNavSections(role: SaasAdminRole | undefined): SaasNavSection[] {
  return saasNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => saasNavVisible(role, item)),
    }))
    .filter((s) => s.items.length > 0);
}

export const clientSubNav = (clientId: string): SaasNavItem[] => [
  { to: saasPath(`/clients/${clientId}`), label: 'Overview', icon: LayoutDashboard, end: true },
  { to: saasPath(`/clients/${clientId}/subscription`), label: 'Subscription', icon: CreditCard },
  { to: saasPath(`/clients/${clientId}/users`), label: 'Users', icon: Users },
  { to: saasPath(`/clients/${clientId}/devices`), label: 'Devices', icon: Monitor },
  { to: saasPath(`/clients/${clientId}/activation-codes`), label: 'Activation codes', icon: KeyRound },
];
