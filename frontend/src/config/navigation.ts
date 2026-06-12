import {

  ArrowLeftRight,

  BarChart3,

  Building2,

  ChefHat,

  ClipboardList,

  CloudOff,

  CreditCard,

  DollarSign,

  FileCheck,

  FileSpreadsheet,

  FileText,

  FolderTree,

  History,

  LayoutDashboard,

  Monitor,

  Package,

  Settings,

  ShieldCheck,

  ShoppingCart,

  Soup,

  Tag,

  Ticket,

  Truck,

  Undo2,

  Users,

  UserCircle,

  UtensilsCrossed,

  Warehouse,

  type LucideIcon,

} from 'lucide-react';

import type { UserRole } from '@/types/auth';

import type { BusinessType } from '@/types/tenant-context';

import { wholesalePrefixedPath } from '@/lib/wholesale-paths';

import { ROUTE_PERMISSIONS } from '@/config/route-permissions';

import { hasAnyPermission, roleMatches } from '@/lib/permissions';



export type NavItem = {

  to: string;

  label: string;

  icon: LucideIcon;

  /** If set, only these roles see the item (legacy fallback) */

  roles?: UserRole[];

  /** Required permission — preferred over roles when set or resolved from route map */

  permission?: string | string[];

};



function resolveItemPermission(item: NavItem): NavItem {

  if (item.permission) return item;

  const mapped = ROUTE_PERMISSIONS[item.to];

  if (typeof mapped === 'string') return { ...item, permission: mapped };

  return item;

}



export function navItemVisible(

  item: NavItem,

  role: UserRole | undefined,

  permissions: readonly string[] | undefined,

): boolean {

  const resolved = resolveItemPermission(item);

  if (resolved.permission) {

    return hasAnyPermission(permissions, resolved.permission);

  }

  if (!resolved.roles) {

    return true;

  }

  if (!role) {

    return false;

  }

  return roleMatches(role, resolved.roles);

}



/** @deprecated Use navItemVisible with permissions */

export function navVisibleForRole(role: UserRole | undefined, item: NavItem): boolean {

  return navItemVisible(item, role, undefined);

}



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

      { to: '/commissions', label: 'Commissions', icon: DollarSign },

      { to: '/refunds', label: 'Refunds', icon: Undo2 },

      { to: '/customers', label: 'Customers', icon: UserCircle },

      { to: '/branches', label: 'Branches', icon: Building2 },

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



export const fnbNavSections: NavSection[] = [

  {

    id: 'fnb-ops',

    label: 'Food & Beverage',

    items: [

      { to: '/fnb/dashboard', label: 'F&B Dashboard', icon: LayoutDashboard },

      { to: '/fnb/pos', label: 'F&B POS', icon: UtensilsCrossed },

      { to: '/fnb/tables', label: 'Tables', icon: ClipboardList, roles: ['OWNER', 'ADMIN'] },

      { to: '/fnb/kitchen', label: 'Kitchen display', icon: ChefHat, roles: ['OWNER', 'ADMIN', 'CASHIER'] },

      { to: '/fnb/menu', label: 'Menu', icon: Soup, roles: ['OWNER', 'ADMIN'] },

      { to: '/fnb/modifiers', label: 'Modifiers', icon: Tag, roles: ['OWNER', 'ADMIN'] },

      { to: '/fnb/ingredients', label: 'Ingredients', icon: Package, roles: ['OWNER', 'ADMIN'] },

      { to: '/fnb/recipes', label: 'Recipes', icon: FolderTree, roles: ['OWNER', 'ADMIN'] },

      { to: '/fnb/waste', label: 'Waste', icon: Warehouse, roles: ['OWNER', 'ADMIN'] },

      { to: '/fnb/delivery', label: 'Delivery', icon: Truck, roles: ['OWNER', 'ADMIN'] },

      { to: '/fnb/reservations', label: 'Reservations', icon: UserCircle, roles: ['OWNER', 'ADMIN'] },

      { to: '/fnb/reports', label: 'F&B Reports', icon: BarChart3, roles: ['OWNER', 'ADMIN'] },

    ],

  },

];



function wholesaleOpsSection(prefixShared: boolean): NavSection {

  const p = prefixShared ? wholesalePrefixedPath : (path: string) => path;

  return {

    id: 'wholesale-ops',

    label: 'Wholesale',

    items: [

      { to: '/wholesale/dashboard', label: 'Dashboard', icon: LayoutDashboard },

      { to: p('/pos'), label: 'Point of sale', icon: CreditCard },

      { to: '/wholesale/quotations', label: 'Quotations', icon: FileText },

      { to: '/wholesale/proforma-invoices', label: 'Proforma invoices', icon: FileSpreadsheet },

      { to: '/wholesale/invoices', label: 'Official invoices', icon: FileCheck },

      { to: '/refunds', label: 'Refunds', icon: Undo2 },

      { to: p('/customers'), label: 'Customers', icon: UserCircle },

      { to: '/wholesale/bulk-pricing', label: 'Bulk pricing', icon: Tag },

      { to: '/wholesale/delivery-notes', label: 'Delivery notes', icon: Truck },

      { to: '/wholesale/payment-terms', label: 'Payment terms', icon: CreditCard },

      { to: '/wholesale/customer-statements', label: 'Customer statements', icon: History },

      { to: '/wholesale/stock-reservations', label: 'Stock reservations', icon: Warehouse },

      { to: '/wholesale/reports', label: 'Wholesale reports', icon: BarChart3 },

      { to: '/wholesale/commissions', label: 'Commissions', icon: DollarSign },

    ],

  };

}



function inventorySection(prefixShared: boolean): NavSection {

  const to = prefixShared ? wholesalePrefixedPath : (x: string) => x;

  return {

    id: prefixShared ? 'wholesale-inventory' : 'shared-inventory',

    label: 'Inventory',

    items: [

      { to: to('/products'), label: 'Products', icon: Package },

      { to: to('/product-labels'), label: 'Product labels', icon: Tag, roles: ['OWNER', 'ADMIN'] },

      { to: to('/categories'), label: 'Categories', icon: FolderTree, roles: ['OWNER', 'ADMIN'] },

      { to: to('/stock-movements'), label: 'Stock movements', icon: Warehouse, roles: ['OWNER', 'ADMIN'] },

      { to: to('/stock-transfers'), label: 'Stock transfers', icon: ArrowLeftRight, roles: ['OWNER', 'ADMIN'] },

      { to: to('/purchases'), label: 'Purchase orders', icon: ShoppingCart, roles: ['OWNER', 'ADMIN'] },

      { to: to('/suppliers'), label: 'Suppliers', icon: Truck, roles: ['OWNER', 'ADMIN'] },

    ],

  };

}



function managementSection(prefixShared: boolean): NavSection {

  const to = prefixShared ? wholesalePrefixedPath : (x: string) => x;

  return {

    id: prefixShared ? 'wholesale-mgmt' : 'shared-mgmt',

    label: 'Management',

    items: [

      { to: to('/branches'), label: 'Branches', icon: Building2, roles: ['OWNER', 'ADMIN', 'CASHIER'] },

      { to: to('/users'), label: 'Users', icon: Users, roles: ['OWNER', 'ADMIN'] },

      { to: to('/offline-queue'), label: 'Offline sync', icon: CloudOff, roles: ['OWNER', 'ADMIN'] },

    ],

  };

}



function settingsSection(prefixShared: boolean): NavSection {

  const to = prefixShared ? wholesalePrefixedPath : (x: string) => x;

  return {

    id: prefixShared ? 'wholesale-settings' : 'shared-settings',

    label: 'Settings',

    items: [

      { to: to('/license'), label: 'License', icon: ShieldCheck },

      { to: to('/billing'), label: 'Billing', icon: CreditCard, roles: ['OWNER'] },

      { to: to('/download'), label: 'Download app', icon: Monitor, roles: ['OWNER'] },

      { to: to('/offline-queue'), label: 'Offline sync', icon: CloudOff, roles: ['OWNER', 'ADMIN'] },

      { to: to('/settings'), label: 'Store settings', icon: Settings, roles: ['OWNER', 'ADMIN'] },

      { to: to('/reports'), label: 'Reports', icon: BarChart3, roles: ['OWNER', 'ADMIN'] },

    ],

  };

}



function filterSectionByAccess(

  section: NavSection,

  role: UserRole | undefined,

  permissions: readonly string[] | undefined,

): NavSection {

  return {

    ...section,

    items: section.items.filter((item) => navItemVisible(item, role, permissions)),

  };

}



function retailSectionsForAccess(

  role: UserRole | undefined,

  permissions: readonly string[] | undefined,

): NavSection[] {

  return navSections

    .map((section) => filterSectionByAccess(section, role, permissions))

    .filter((s) => s.items.length > 0);

}



export function visibleNavSections(

  role: UserRole | undefined,

  permissions?: readonly string[],

): NavSection[] {

  return retailSectionsForAccess(role, permissions);

}



/** Sidebar sections filtered by user role, permissions, and tenant business type. */

export function visibleNavSectionsForBusiness(

  role: UserRole | undefined,

  businessType: BusinessType | undefined,

  fnbEnabled: boolean,

  wholesaleEnabled: boolean,

  permissions?: readonly string[],

): NavSection[] {

  const isRetail = !businessType || businessType === 'RETAIL' || businessType === 'HYBRID';

  const isFnb = (businessType === 'FOOD_BEVERAGE' || businessType === 'HYBRID') && fnbEnabled;

  const isWholesale = (businessType === 'WHOLESALE' || businessType === 'HYBRID') && wholesaleEnabled;



  const out: NavSection[] = [];



  if (businessType === 'HYBRID') {

    if (isRetail) {

      const retail = retailSectionsForAccess(role, permissions).map((s) => ({

        ...s,

        id: `retail-${s.id}`,

        label: s.id === 'sales' ? 'Retail' : s.label,

      }));

      out.push(...retail);

    }

    if (isFnb) {

      const fnb = filterSectionByAccess(fnbNavSections[0], role, permissions);

      if (fnb.items.length > 0) out.push(fnb);

    }

    if (isWholesale) {

      const wholesale = filterSectionByAccess(wholesaleOpsSection(false), role, permissions);

      if (wholesale.items.length > 0) out.push(wholesale);

      const inv = filterSectionByAccess(inventorySection(false), role, permissions);

      if (inv.items.length > 0) out.push(inv);

    }

    const mgmt = filterSectionByAccess(managementSection(false), role, permissions);

    const settings = filterSectionByAccess(settingsSection(false), role, permissions);

    if (mgmt.items.length > 0) out.push(mgmt);

    if (settings.items.length > 0) out.push(settings);

    return out;

  }



  if (isWholesale && businessType === 'WHOLESALE') {

    const wholesale = filterSectionByAccess(wholesaleOpsSection(true), role, permissions);

    if (wholesale.items.length > 0) out.push(wholesale);

    const inv = filterSectionByAccess(inventorySection(true), role, permissions);

    const mgmt = filterSectionByAccess(managementSection(true), role, permissions);

    const settings = filterSectionByAccess(settingsSection(true), role, permissions);

    if (inv.items.length > 0) out.push(inv);

    if (mgmt.items.length > 0) out.push(mgmt);

    if (settings.items.length > 0) out.push(settings);

    return out;

  }



  if (isRetail) {

    out.push(...retailSectionsForAccess(role, permissions));

  }



  if (isFnb) {

    const fnb = filterSectionByAccess(fnbNavSections[0], role, permissions);

    if (fnb.items.length > 0) out.push(fnb);

    if (businessType === 'FOOD_BEVERAGE') {

      const mgmt = filterSectionByAccess(managementSection(false), role, permissions);

      const settings = filterSectionByAccess(settingsSection(false), role, permissions);

      if (mgmt.items.length > 0) out.push(mgmt);

      if (settings.items.length > 0) out.push(settings);

    }

  }



  return out;

}


