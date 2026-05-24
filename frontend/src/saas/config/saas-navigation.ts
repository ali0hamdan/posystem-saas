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
    items: [{ to: '/saas/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'clients',
    label: 'Clients',
    items: [
      { to: '/saas/clients', label: 'All clients', icon: Building2, end: true },
      { to: '/saas/clients/pending', label: 'Pending payment', icon: Clock },
      { to: '/saas/clients/expiring', label: 'Expiring soon', icon: ShieldAlert },
      { to: '/saas/clients/suspended', label: 'Suspended', icon: Users },
    ],
  },
  {
    id: 'licensing',
    label: 'Licensing',
    items: [
      { to: '/saas/plans', label: 'Plans', icon: CreditCard, roles: ['SUPER_ADMIN', 'SUPPORT', 'BILLING'] },
      { to: '/saas/subscriptions', label: 'Subscriptions', icon: ClipboardList },
      { to: '/saas/activation-codes', label: 'Activation codes', icon: KeyRound },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { to: '/saas/devices', label: 'Devices', icon: Monitor },
      { to: '/saas/audit-logs', label: 'Audit logs', icon: ClipboardList },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [{ to: '/saas/settings', label: 'Platform settings', icon: Settings, roles: ['SUPER_ADMIN'] }],
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
  { to: `/saas/clients/${clientId}`, label: 'Overview', icon: LayoutDashboard, end: true },
  { to: `/saas/clients/${clientId}/subscription`, label: 'Subscription', icon: CreditCard },
  { to: `/saas/clients/${clientId}/users`, label: 'Users', icon: Users },
  { to: `/saas/clients/${clientId}/devices`, label: 'Devices', icon: Monitor },
  { to: `/saas/clients/${clientId}/activation-codes`, label: 'Activation codes', icon: KeyRound },
];
