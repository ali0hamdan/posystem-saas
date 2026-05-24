import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  CloudOff,
  CreditCard,
  FolderTree,
  History,
  LayoutDashboard,
  Monitor,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Ticket,
  Truck,
  Users,
  UserCircle,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types/auth';

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** If set, only these roles see the item */
  roles?: UserRole[];
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    id: 'sales',
    label: 'Sales',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/pos', label: 'Point of sale', icon: CreditCard },
      { to: '/sales', label: 'Sales history', icon: History },
      {
        to: '/customers',
        label: 'Customers',
        icon: UserCircle,
        roles: ['OWNER', 'ADMIN', 'CASHIER'],
      },
      { to: '/branches', label: 'Branches', icon: Building2, roles: ['OWNER', 'ADMIN', 'CASHIER'] },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    items: [
      { to: '/products', label: 'Products', icon: Package },
      { to: '/product-labels', label: 'Product labels', icon: Tag, roles: ['OWNER', 'ADMIN'] },
      { to: '/categories', label: 'Categories', icon: FolderTree, roles: ['OWNER', 'ADMIN'] },
      { to: '/stock-movements', label: 'Stock movements', icon: Warehouse, roles: ['OWNER', 'ADMIN'] },
      {
        to: '/stock-transfers',
        label: 'Stock transfers',
        icon: ArrowLeftRight,
        roles: ['OWNER', 'ADMIN'],
      },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    items: [
      { to: '/purchases', label: 'Purchase orders', icon: ShoppingCart, roles: ['OWNER', 'ADMIN'] },
      { to: '/suppliers', label: 'Suppliers', icon: Truck, roles: ['OWNER', 'ADMIN'] },
      { to: '/coupons', label: 'Coupons', icon: Ticket, roles: ['OWNER', 'ADMIN'] },
      { to: '/users', label: 'Users', icon: Users, roles: ['OWNER', 'ADMIN'] },
      { to: '/offline-queue', label: 'Offline sync', icon: CloudOff, roles: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    items: [{ to: '/reports', label: 'Reports', icon: BarChart3, roles: ['OWNER', 'ADMIN'] }],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { to: '/billing', label: 'Billing', icon: CreditCard, roles: ['OWNER'] },
      { to: '/download', label: 'Download app', icon: Monitor, roles: ['OWNER'] },
      { to: '/license', label: 'License', icon: ShieldCheck },
      { to: '/settings', label: 'Store settings', icon: Settings, roles: ['OWNER', 'ADMIN'] },
    ],
  },
];

/** Flat list for backwards compatibility */
export const mainNav: NavItem[] = navSections.flatMap((s) => s.items);

export function navVisibleForRole(role: UserRole | undefined, item: NavItem): boolean {
  if (!item.roles) {
    return true;
  }
  if (!role) {
    return false;
  }
  return item.roles.includes(role);
}

export function visibleNavSections(role: UserRole | undefined): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => navVisibleForRole(role, item)),
    }))
    .filter((s) => s.items.length > 0);
}
