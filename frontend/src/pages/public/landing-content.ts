import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  FileText,
  Layers,
  Lock,
  Mail,
  Monitor,
  Package,
  Receipt,
  Shield,
  Store,
  Users,
  UtensilsCrossed,
  Warehouse,
} from 'lucide-react';
import type { OnboardingBusinessType } from '@/api/public.api';

export const HERO_HIGHLIGHT = 'Launch your POS in minutes';

export const HERO_SUBHEADLINE =
  'Manage sales, inventory, invoices, customers, and reports from one secure dashboard.';

export const ONBOARDING_STEPS: { title: string; description: string }[] = [
  {
    title: 'Choose your system',
    description: 'Retail, Food & Beverage, or Wholesale.',
  },
  {
    title: 'Select your package',
    description: 'Pick the plan that matches your users, branches, devices, and features.',
  },
  {
    title: 'Verify your email',
    description: 'Secure your account with OTP verification.',
  },
  {
    title: 'Open your dashboard',
    description: 'Start from the right dashboard based on your selected system.',
  },
];

export const HERO_BADGES = [
  'Retail POS',
  'Food & Beverage POS',
  'Wholesale / B2B',
  'Multi-branch',
  'Cloud + Desktop ready',
] as const;

export const HERO_STATS: { icon: LucideIcon; label: string }[] = [
  { icon: Layers, label: 'Multi-tenant SaaS' },
  { icon: Package, label: 'Real-time inventory' },
  { icon: Shield, label: 'Role-based access' },
  { icon: Mail, label: 'Email notifications' },
  { icon: Receipt, label: 'Printable invoices & receipts' },
];

export type BusinessTypeCard = {
  id: OnboardingBusinessType;
  title: string;
  description: string;
  features: string[];
  icon: LucideIcon;
  ctaType?: OnboardingBusinessType;
};

export const BUSINESS_TYPE_CARDS: BusinessTypeCard[] = [
  {
    id: 'RETAIL',
    title: 'Retail POS',
    description:
      'For shops, supermarkets, electronics stores, pharmacies, boutiques, and retail businesses.',
    features: [
      'Barcode sales',
      'Product management',
      'Stock tracking',
      'Customer debt',
      'Purchase orders',
      'Sales reports',
    ],
    icon: Store,
    ctaType: 'RETAIL',
  },
  {
    id: 'FOOD_BEVERAGE',
    title: 'Food & Beverage POS',
    description:
      'For restaurants, cafés, snack shops, cloud kitchens, and dine-in/takeaway businesses.',
    features: [
      'Tables',
      'Orders',
      'Kitchen workflow',
      'Menu items',
      'Modifiers',
      'Ingredients and recipes',
      'Delivery and reservations (package-dependent)',
    ],
    icon: UtensilsCrossed,
    ctaType: 'FOOD_BEVERAGE',
  },
  {
    id: 'WHOLESALE',
    title: 'Wholesale / B2B POS',
    description: 'For warehouses, distributors, suppliers, and B2B companies.',
    features: [
      'Quotations',
      'Proforma invoices',
      'Official invoices',
      'Bulk pricing',
      'Customer statements',
      'Payment terms',
      'Delivery notes',
      'Stock reservations',
    ],
    icon: Warehouse,
    ctaType: 'WHOLESALE',
  },
];

export const CORE_FEATURE_GROUPS: { title: string; items: string[] }[] = [
  {
    title: 'Sales & documents',
    items: [
      'Sales and invoices',
      'Refunds — full and partial',
      'Receipt and invoice printing',
      'Quotations, proforma, and official invoices (Wholesale)',
    ],
  },
  {
    title: 'Catalog & inventory',
    items: [
      'Products and categories',
      'SKU and barcode generation',
      'Stock management',
      'Stock movements',
      'Stock transfers',
      'Purchase orders',
      'Suppliers',
    ],
  },
  {
    title: 'Customers & branches',
    items: ['Customers', 'Customer debt / ledger', 'Multi-branch support'],
  },
  {
    title: 'Team & security',
    items: [
      'Users and roles',
      'Permissions by role',
      'Email OTP verification',
      'Password reset',
    ],
  },
  {
    title: 'Insights & operations',
    items: [
      'Reports and dashboards',
      'Email notifications',
      'License and subscription management',
      'Offline sync (package-dependent)',
    ],
  },
];

export const RETAIL_FEATURES = [
  'POS checkout',
  'Barcode scanner support',
  'Product labels',
  'Categories',
  'Stock alerts',
  'Purchase orders',
  'Suppliers',
  'Customer debt',
  'Refunds',
  'Sales reports',
  'Cashier, Salesman, and Stock Manager roles',
];

export const FNB_FEATURES = [
  'Tables',
  'Waiter orders',
  'Kitchen display / tickets',
  'Menu items',
  'Modifiers',
  'Ingredients',
  'Recipes',
  'Dine-in, takeaway, and delivery',
  'Tips and service charge',
  'Refunds',
  'Cashier and Waiter roles',
];

export const WHOLESALE_FEATURES = [
  'Quotations',
  'Proforma invoices',
  'Official invoices',
  'Bulk pricing',
  'Customer price lists',
  'Payment terms',
  'Customer statements',
  'Delivery notes',
  'Stock reservations',
  'Refunds / credit notes',
  'Salesman, Stock Manager, and Cashier roles',
];

export const WHY_CHOOSE: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Layers,
    title: 'Built for different business types',
    desc: 'One SaaS platform with Retail, F&B, and Wholesale workflows.',
  },
  {
    icon: Package,
    title: 'Real-time inventory control',
    desc: 'Track stock, movements, transfers, and purchase receiving across branches.',
  },
  {
    icon: Lock,
    title: 'Secure multi-tenant data isolation',
    desc: 'Every client account is separated — no shared data between businesses.',
  },
  {
    icon: Users,
    title: 'Role-based permissions',
    desc: 'Owner, managers, cashiers, sales staff, stock managers, and waiters see only what they need.',
  },
  {
    icon: FileText,
    title: 'Professional invoices and receipts',
    desc: 'Print receipts, quotations, proforma invoices, delivery notes, and statements.',
  },
  {
    icon: Mail,
    title: 'Email verification and notifications',
    desc: 'OTP email verification, password reset, and configurable business alerts.',
  },
  {
    icon: Monitor,
    title: 'Cloud SaaS with desktop-ready workflow',
    desc: 'Use in the browser or with the desktop app when your package includes it.',
  },
  {
    icon: BarChart3,
    title: 'Scalable packages',
    desc: 'Starter, Business, and Pro plans with clear limits on users, branches, and devices.',
  },
];

export const NOTIFICATION_TYPES = [
  'Low stock alerts',
  'Purchase completed',
  'Subscription expiring 48 hours before',
  'Subscription expiring 24 hours before',
  'Welcome message',
  'New user added',
  'Stock added',
  'Subscription renewed invoice',
  'Password reset confirmation',
];

export const ROLE_GROUPS: { title: string; roles: string[] }[] = [
  { title: 'Every business type', roles: ['Owner', 'General Manager', 'Co-Manager', 'Cashier'] },
  { title: 'Retail & Wholesale', roles: ['Salesman', 'Stock Manager'] },
  { title: 'Food & Beverage', roles: ['Waiter'] },
];

export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Can I choose the system type during registration?',
    a: 'Yes. You can choose Retail, Food & Beverage, or Wholesale when you create your account.',
  },
  {
    q: 'Can I change my package later?',
    a: 'Yes. Packages can be upgraded or renewed from the subscription and billing area in your dashboard.',
  },
  {
    q: 'Does Wholesale support quotations and proforma invoices?',
    a: 'Yes. Wholesale supports quotations, proforma invoices, official invoices, bulk pricing, delivery notes, and customer statements (availability depends on your plan).',
  },
  {
    q: 'Does F&B support tables and waiters?',
    a: 'Yes. F&B supports tables, waiter orders, kitchen workflow, menu items, modifiers, and payments (availability depends on your plan).',
  },
  {
    q: 'Can I manage users and permissions?',
    a: 'Yes. Owners can create users and assign roles based on your business type. Each role has specific permissions.',
  },
  {
    q: 'Are invoices printable?',
    a: 'Yes. Receipts, quotations, proforma invoices, official invoices, delivery notes, customer statements, and refund receipts can be printed.',
  },
  {
    q: 'Is customer data private?',
    a: 'Yes. Each client’s data is isolated from other clients. Products, customers, invoices, and reports are scoped to your account.',
  },
];

export const PRICING_TYPE_CONTEXT: Record<
  'RETAIL' | 'FOOD_BEVERAGE' | 'WHOLESALE',
  { label: string; summary: string }
> = {
  RETAIL: {
    label: 'Retail',
    summary: 'Barcode checkout, inventory, customer debt, and retail reports.',
  },
  FOOD_BEVERAGE: {
    label: 'Food & Beverage',
    summary: 'Tables, orders, kitchen, menu, and F&B payments.',
  },
  WHOLESALE: {
    label: 'Wholesale / B2B',
    summary: 'Quotations, proforma, official invoices, bulk pricing, and B2B documents.',
  },
};

export const NAV_SECTIONS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Business types', href: '#business-types' },
  { label: 'Features', href: '#features' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
] as const;
