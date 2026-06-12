import { config } from 'dotenv';
import { resolve } from 'path';
import { hash } from 'bcrypt';
import {
  BillingCycle,
  BusinessType,
  ClientStatus,
  LicensePlan,
  PlanType,
  Prisma,
  PrismaClient,
  SaasAdminRole,
  StockMovementType,
  UserRole,
} from '@prisma/client';

// Ensure SAAS_ADMIN_* and DATABASE_URL are loaded when running `prisma db seed`
config({ path: resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

/** Stable slug for idempotent demo tenant upsert. */
const DEMO_CLIENT_SLUG = 'demo-store';

/** Stable category IDs (globally unique) tied to the demo client. */
const CATEGORY_IDS = {
  food: '00000000-0000-4000-8000-000000000001',
  drinks: '00000000-0000-4000-8000-000000000002',
  cleaning: '00000000-0000-4000-8000-000000000003',
  electronics: '00000000-0000-4000-8000-000000000004',
  other: '00000000-0000-4000-8000-000000000005',
} as const;

const DEV_DEFAULT_ADMIN_PASSWORD =
  'DevOnly!ChangeMe-8c4f9a2e1b7d6a5c3e2f1d0a9b8c7e6f';

/** Dev-only password for role tests; same rules as admin default (development/test only). */
const DEV_SEED_CASHIER_PASSWORD =
  'CashierDev!RoleTest-1a2b3c4d5e6f708192a';

function resolveAdminPasswordPlain(): string {
  const fromEnv = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv === 'production') {
    throw new Error(
      'SEED_ADMIN_PASSWORD is required when NODE_ENV is production.',
    );
  }

  if (
    nodeEnv === 'development' ||
    nodeEnv === 'test' ||
    nodeEnv === undefined
  ) {
    return DEV_DEFAULT_ADMIN_PASSWORD;
  }

  throw new Error(
    'SEED_ADMIN_PASSWORD is required unless NODE_ENV is development or test.',
  );
}

function money(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

async function ensureDemoClient() {
  return prisma.client.upsert({
    where: { slug: DEMO_CLIENT_SLUG },
    update: {
      businessName: 'Demo Store',
      ownerName: 'Demo Owner',
      email: 'owner@example.com',
      status: ClientStatus.ACTIVE,
    },
    create: {
      slug: DEMO_CLIENT_SLUG,
      businessName: 'Demo Store',
      ownerName: 'Demo Owner',
      email: 'owner@example.com',
      status: ClientStatus.ACTIVE,
    },
  });
}

async function ensureMainBranch(clientId: string) {
  return prisma.branch.upsert({
    where: {
      clientId_code: {
        clientId,
        code: 'MAIN',
      },
    },
    update: {
      name: 'Main Branch',
      isActive: true,
    },
    create: {
      clientId,
      name: 'Main Branch',
      code: 'MAIN',
    },
  });
}

async function seedOwnerUser(clientId: string, passwordPlain: string) {
  const passwordHash = await hash(passwordPlain, BCRYPT_ROUNDS);

  return prisma.user.upsert({
    where: {
      clientId_username: {
        clientId,
        username: 'admin',
      },
    },
    update: {
      name: 'Administrator',
      email: 'admin@pos.local',
      passwordHash,
      role: UserRole.OWNER,
      isActive: true,
    },
    create: {
      clientId,
      name: 'Administrator',
      username: 'admin',
      email: 'admin@pos.local',
      passwordHash,
      role: UserRole.OWNER,
    },
  });
}

async function seedDemoCashierUser(clientId: string) {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production') {
    return null;
  }
  if (
    nodeEnv !== 'development' &&
    nodeEnv !== 'test' &&
    nodeEnv !== undefined
  ) {
    return null;
  }

  const passwordHash = await hash(DEV_SEED_CASHIER_PASSWORD, BCRYPT_ROUNDS);

  return prisma.user.upsert({
    where: {
      clientId_username: {
        clientId,
        username: 'cashier',
      },
    },
    update: {
      name: 'Demo Cashier',
      passwordHash,
      role: UserRole.CASHIER,
      isActive: true,
    },
    create: {
      clientId,
      name: 'Demo Cashier',
      username: 'cashier',
      email: null,
      passwordHash,
      role: UserRole.CASHIER,
    },
  });
}

async function ensureUserBranch(userId: string, branchId: string) {
  await prisma.userBranch.upsert({
    where: {
      userId_branchId: {
        userId,
        branchId,
      },
    },
    create: { userId, branchId },
    update: {},
  });
}

async function seedCategories(clientId: string): Promise<void> {
  const rows: { id: string; name: string; description: string }[] = [
    {
      id: CATEGORY_IDS.food,
      name: 'Food',
      description: 'Seeded category: food',
    },
    {
      id: CATEGORY_IDS.drinks,
      name: 'Drinks',
      description: 'Seeded category: drinks',
    },
    {
      id: CATEGORY_IDS.cleaning,
      name: 'Cleaning',
      description: 'Seeded category: cleaning',
    },
    {
      id: CATEGORY_IDS.electronics,
      name: 'Electronics',
      description: 'Seeded category: electronics',
    },
    {
      id: CATEGORY_IDS.other,
      name: 'Other',
      description: 'Seeded category: other',
    },
  ];

  for (const row of rows) {
    await prisma.category.upsert({
      where: { id: row.id },
      update: {
        clientId,
        name: row.name,
        description: row.description,
        isActive: true,
      },
      create: {
        id: row.id,
        clientId,
        name: row.name,
        description: row.description,
        isActive: true,
      },
    });
  }
}

type SeedProduct = {
  sku: string;
  name: string;
  barcode: string;
  categoryId: string;
  costPrice: string;
  sellingPrice: string;
  quantity: number;
  minStock: number;
  unitType: string;
};

async function seedProducts(
  clientId: string,
  branchId: string,
  ownerUserId: string,
): Promise<void> {
  const products: SeedProduct[] = [
    {
      sku: 'SEED-FOOD-BREAD',
      name: 'Whole Wheat Bread',
      barcode: 'SEED-859100000001',
      categoryId: CATEGORY_IDS.food,
      costPrice: '1.20',
      sellingPrice: '2.49',
      quantity: 48,
      minStock: 8,
      unitType: 'PCS',
    },
    {
      sku: 'SEED-FOOD-RICE',
      name: 'Basmati Rice 1kg',
      barcode: 'SEED-859100000002',
      categoryId: CATEGORY_IDS.food,
      costPrice: '2.80',
      sellingPrice: '4.99',
      quantity: 36,
      minStock: 6,
      unitType: 'PCS',
    },
    {
      sku: 'SEED-FOOD-APPLE',
      name: 'Apples (kg)',
      barcode: 'SEED-859100000003',
      categoryId: CATEGORY_IDS.food,
      costPrice: '1.50',
      sellingPrice: '2.99',
      quantity: 100,
      minStock: 15,
      unitType: 'KG',
    },
    {
      sku: 'SEED-DRINK-WATER',
      name: 'Still Water 500ml',
      barcode: 'SEED-859200000001',
      categoryId: CATEGORY_IDS.drinks,
      costPrice: '0.35',
      sellingPrice: '0.99',
      quantity: 120,
      minStock: 24,
      unitType: 'PCS',
    },
    {
      sku: 'SEED-DRINK-SODA',
      name: 'Cola 330ml',
      barcode: 'SEED-859200000002',
      categoryId: CATEGORY_IDS.drinks,
      costPrice: '0.55',
      sellingPrice: '1.49',
      quantity: 72,
      minStock: 12,
      unitType: 'PCS',
    },
    {
      sku: 'SEED-CLEAN-SOAP',
      name: 'Dish Soap 750ml',
      barcode: 'SEED-859300000001',
      categoryId: CATEGORY_IDS.cleaning,
      costPrice: '1.90',
      sellingPrice: '3.49',
      quantity: 24,
      minStock: 4,
      unitType: 'PCS',
    },
    {
      sku: 'SEED-ELEC-USB',
      name: 'USB-C Cable 1m',
      barcode: 'SEED-859400000001',
      categoryId: CATEGORY_IDS.electronics,
      costPrice: '3.50',
      sellingPrice: '8.99',
      quantity: 30,
      minStock: 5,
      unitType: 'PCS',
    },
    {
      sku: 'SEED-OTHER-TAPE',
      name: 'Packing Tape',
      barcode: 'SEED-859500000001',
      categoryId: CATEGORY_IDS.other,
      costPrice: '1.10',
      sellingPrice: '2.29',
      quantity: 40,
      minStock: 8,
      unitType: 'PCS',
    },
  ];

  for (const p of products) {
    const row = await prisma.product.upsert({
      where: {
        clientId_sku: {
          clientId,
          sku: p.sku,
        },
      },
      update: {
        name: p.name,
        barcode: p.barcode,
        categoryId: p.categoryId,
        supplierId: null,
        costPrice: money(p.costPrice),
        sellingPrice: money(p.sellingPrice),
        unitType: p.unitType,
        isActive: true,
      },
      create: {
        clientId,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        categoryId: p.categoryId,
        supplierId: null,
        costPrice: money(p.costPrice),
        sellingPrice: money(p.sellingPrice),
        unitType: p.unitType,
        isActive: true,
      },
    });

    const beforeBs = await prisma.branchStock.findUnique({
      where: {
        branchId_productId: {
          branchId,
          productId: row.id,
        },
      },
      select: { quantity: true },
    });
    const previousQty = beforeBs?.quantity ?? 0;

    await prisma.branchStock.upsert({
      where: {
        branchId_productId: {
          branchId,
          productId: row.id,
        },
      },
      update: {
        quantity: p.quantity,
        minStock: p.minStock,
      },
      create: {
        branchId,
        productId: row.id,
        quantity: p.quantity,
        minStock: p.minStock,
      },
    });

    const seedRefId = `initial:${row.id}`;
    const existingMovement = await prisma.stockMovement.findFirst({
      where: {
        clientId,
        branchId,
        productId: row.id,
        referenceType: 'seed',
        referenceId: seedRefId,
      },
    });

    const targetQty = p.quantity;
    if (existingMovement) {
      continue;
    }
    if (previousQty === targetQty && targetQty > 0) {
      continue;
    }
    if (previousQty === targetQty && targetQty === 0) {
      continue;
    }

    const delta = targetQty - previousQty;
    const movementType =
      previousQty === 0 && delta > 0
        ? StockMovementType.PURCHASE
        : StockMovementType.ADJUSTMENT;

    await prisma.stockMovement.create({
      data: {
        clientId,
        branchId,
        productId: row.id,
        type: movementType,
        quantityChange: delta,
        previousQuantity: previousQty,
        newQuantity: targetQty,
        reason: 'Seed: branch inventory sync',
        referenceType: 'seed',
        referenceId: seedRefId,
        createdById: ownerUserId,
      },
    });
  }
}

async function seedSaasPlatformAdmin(): Promise<void> {
  const rawEmail = process.env.SAAS_ADMIN_EMAIL?.trim();
  const password = process.env.SAAS_ADMIN_PASSWORD?.trim();
  const email = rawEmail?.toLowerCase();
  const nodeEnv = process.env.NODE_ENV;

  if (!email || !password) {
    const msg =
      '[seed] SAAS_ADMIN_EMAIL / SAAS_ADMIN_PASSWORD not set — skipping SaaS super-admin seed.';
    if (nodeEnv === 'production') {
      console.warn(msg);
    } else if (nodeEnv === 'development' || nodeEnv === 'test' || !nodeEnv) {
      console.warn(msg);
    }
    return;
  }

  const passwordHash = await hash(password, BCRYPT_ROUNDS);
  const row = await prisma.saaSAdmin.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: 'Platform Super Admin',
      role: SaasAdminRole.SUPER_ADMIN,
      isActive: true,
    },
    update: {
      passwordHash,
      role: SaasAdminRole.SUPER_ADMIN,
      isActive: true,
      name: 'Platform Super Admin',
    },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (nodeEnv === 'development' || nodeEnv === 'test' || !nodeEnv) {
    console.log(
      JSON.stringify({
        saasAdminSeed: 'upserted',
        email: row.email,
        role: row.role,
        isActive: row.isActive,
      }),
    );
  }
}

// Feature flag sets per plan. F&B keys default to false on STARTER and are
// upgraded per tier so the F&B module is usable only on plans that include it.
const STARTER_FEATURES = {
  products: true,
  sales: true,
  receipt_printing: true,
  basic_reports: true,
  advanced_reports: false,
  stock_management: false,
  purchase_orders: false,
  suppliers: false,
  customer_debt: false,
  multi_branch: false,
  stock_transfers: false,
  offline_mode: false,
  barcode_labels: false,
  desktop_download: false,
  user_management: true,
  coupon_management: false,
  // F&B
  fnb_module: false,
  table_management: false,
  kitchen_display: false,
  recipe_inventory: false,
  delivery_management: false,
  reservations: false,
  split_billing: false,
  multi_printer_routing: false,
  // Wholesale / B2B
  wholesale_module: false,
  quotations: false,
  proforma_invoices: false,
  official_invoices: false,
  bulk_pricing: false,
  customer_credit: false,
  payment_terms: false,
  delivery_notes: false,
  stock_reservations: false,
  customer_statements: false,
  approval_workflow: false,
};

const BUSINESS_FEATURES = {
  ...STARTER_FEATURES,
  stock_management: true,
  purchase_orders: true,
  suppliers: true,
  customer_debt: true,
  basic_reports: true,
  coupon_management: true,
  // F&B base set on BUSINESS so restaurants can adopt without PRO.
  fnb_module: true,
  table_management: true,
  kitchen_display: true,
  reservations: true,
  split_billing: true,
  // Wholesale / B2B available from BUSINESS up.
  wholesale_module: true,
  quotations: true,
  proforma_invoices: true,
  official_invoices: true,
  bulk_pricing: true,
  customer_credit: true,
  payment_terms: true,
  delivery_notes: true,
  customer_statements: true,
};

const PRO_FEATURES = {
  ...BUSINESS_FEATURES,
  advanced_reports: true,
  multi_branch: true,
  stock_transfers: true,
  offline_mode: true,
  barcode_labels: true,
  desktop_download: true,
  // Full F&B on PRO.
  recipe_inventory: true,
  delivery_management: true,
  multi_printer_routing: true,
  // Full wholesale on PRO.
  stock_reservations: true,
  approval_workflow: true,
};

const LIFETIME_FEATURES = {
  products: true,
  sales: true,
  receipt_printing: true,
  basic_reports: true,
  advanced_reports: false,
  stock_management: true,
  purchase_orders: false,
  suppliers: false,
  customer_debt: false,
  multi_branch: false,
  stock_transfers: false,
  offline_mode: false,
  barcode_labels: true,
  desktop_download: true,
  user_management: true,
  coupon_management: false,
  // F&B retail-leaning lifetime: kitchen+menu, no delivery/recipe.
  fnb_module: true,
  table_management: true,
  kitchen_display: true,
  recipe_inventory: false,
  delivery_management: false,
  reservations: false,
  split_billing: true,
  multi_printer_routing: false,
  // Lifetime wholesale bundle: core documents, no reservations/approval.
  wholesale_module: true,
  quotations: true,
  proforma_invoices: true,
  official_invoices: true,
  bulk_pricing: true,
  customer_credit: true,
  payment_terms: true,
  delivery_notes: false,
  stock_reservations: false,
  customer_statements: true,
  approval_workflow: false,
};

// ---------------------------------------------------------------------------
// Business-type-specific Desktop Lifetime feature sets. One-time desktop
// license = unlimited desktop use with ALL features for the selected business
// type — but never the other verticals' modules.
// ---------------------------------------------------------------------------

/** All vertical-agnostic (core) features, fully enabled. */
const CORE_FULL_FEATURES = {
  products: true,
  sales: true,
  receipt_printing: true,
  basic_reports: true,
  advanced_reports: true,
  stock_management: true,
  purchase_orders: true,
  suppliers: true,
  customer_debt: true,
  multi_branch: true,
  stock_transfers: true,
  offline_mode: true,
  barcode_labels: true,
  desktop_download: true,
  user_management: true,
  coupon_management: true,
};

const RETAIL_DESKTOP_LIFETIME_FEATURES = {
  ...STARTER_FEATURES,
  ...CORE_FULL_FEATURES,
  // Retail only — no F&B, no Wholesale modules.
};

const FNB_DESKTOP_LIFETIME_FEATURES = {
  ...STARTER_FEATURES,
  ...CORE_FULL_FEATURES,
  // Full F&B module — no Wholesale.
  fnb_module: true,
  table_management: true,
  kitchen_display: true,
  recipe_inventory: true,
  delivery_management: true,
  reservations: true,
  split_billing: true,
  multi_printer_routing: true,
};

const WHOLESALE_DESKTOP_LIFETIME_FEATURES = {
  ...STARTER_FEATURES,
  ...CORE_FULL_FEATURES,
  // Full Wholesale / B2B module — no F&B.
  wholesale_module: true,
  quotations: true,
  proforma_invoices: true,
  official_invoices: true,
  bulk_pricing: true,
  customer_credit: true,
  payment_terms: true,
  delivery_notes: true,
  stock_reservations: true,
  customer_statements: true,
  approval_workflow: true,
};

async function seedPlans(): Promise<void> {
  type PlanSeed = {
    code: LicensePlan;
    name: string;
    description: string;
    type: PlanType;
    businessType: BusinessType | null;
    monthlyPrice: string | null;
    yearlyPrice: string | null;
    oneTimePrice: string | null;
    currency: string;
    /** Null = unlimited (Desktop Lifetime plans). */
    maxUsers: number | null;
    maxBranches: number | null;
    maxDevices: number | null;
    features: Record<string, boolean>;
    allowsDesktopDownload: boolean;
    isActive: boolean;
    sortOrder: number;
  };

  const plans: PlanSeed[] = [
    {
      code: LicensePlan.STARTER,
      name: 'Starter',
      description: 'Perfect for small shops getting started.',
      type: PlanType.SUBSCRIPTION,
      businessType: null,
      monthlyPrice: '29.00',
      yearlyPrice: '290.00',
      oneTimePrice: null,
      currency: 'USD',
      maxUsers: 2,
      maxBranches: 1,
      maxDevices: 1,
      features: STARTER_FEATURES,
      allowsDesktopDownload: false,
      isActive: true,
      sortOrder: 1,
    },
    {
      code: LicensePlan.BUSINESS,
      name: 'Business',
      description: 'For growing businesses with full inventory management.',
      type: PlanType.SUBSCRIPTION,
      businessType: null,
      monthlyPrice: '59.00',
      yearlyPrice: '590.00',
      oneTimePrice: null,
      currency: 'USD',
      maxUsers: 8,
      maxBranches: 2,
      maxDevices: 3,
      features: BUSINESS_FEATURES,
      allowsDesktopDownload: false,
      isActive: true,
      sortOrder: 2,
    },
    {
      code: LicensePlan.PRO,
      name: 'Pro',
      description: 'Multi-branch, advanced reports, and offline POS.',
      type: PlanType.SUBSCRIPTION,
      businessType: null,
      monthlyPrice: '99.00',
      yearlyPrice: '990.00',
      oneTimePrice: null,
      currency: 'USD',
      maxUsers: 20,
      maxBranches: 5,
      maxDevices: 10,
      features: PRO_FEATURES,
      allowsDesktopDownload: true,
      isActive: true,
      sortOrder: 3,
    },
    {
      // Legacy generic lifetime plan — superseded by the business-type-specific
      // Desktop Lifetime plans below. Kept (inactive) so existing subscriptions
      // and activation codes referencing it keep working.
      code: LicensePlan.LIFETIME_DESKTOP,
      name: 'Lifetime Desktop',
      description: 'One-time payment. Own it forever. Desktop POS included.',
      type: PlanType.ONE_TIME,
      businessType: null,
      monthlyPrice: null,
      yearlyPrice: null,
      oneTimePrice: '499.00',
      currency: 'USD',
      maxUsers: 5,
      maxBranches: 1,
      maxDevices: 2,
      features: LIFETIME_FEATURES,
      allowsDesktopDownload: true,
      isActive: false,
      sortOrder: 4,
    },
    {
      code: LicensePlan.RETAIL_DESKTOP_LIFETIME,
      name: 'Retail Desktop Lifetime',
      description:
        'One-time desktop license. Unlimited desktop use for your retail POS — download and activate your POS desktop app.',
      type: PlanType.ONE_TIME,
      businessType: BusinessType.RETAIL,
      monthlyPrice: null,
      yearlyPrice: null,
      oneTimePrice: '999.00',
      currency: 'USD',
      maxUsers: null,
      maxBranches: null,
      maxDevices: null,
      features: RETAIL_DESKTOP_LIFETIME_FEATURES,
      allowsDesktopDownload: true,
      isActive: true,
      sortOrder: 5,
    },
    {
      code: LicensePlan.FNB_DESKTOP_LIFETIME,
      name: 'F&B Desktop Lifetime',
      description:
        'One-time desktop license. Unlimited desktop use for your restaurant POS (tables, menu, orders, kitchen) — download and activate your POS desktop app.',
      type: PlanType.ONE_TIME,
      businessType: BusinessType.FOOD_BEVERAGE,
      monthlyPrice: null,
      yearlyPrice: null,
      oneTimePrice: '999.00',
      currency: 'USD',
      maxUsers: null,
      maxBranches: null,
      maxDevices: null,
      features: FNB_DESKTOP_LIFETIME_FEATURES,
      allowsDesktopDownload: true,
      isActive: true,
      sortOrder: 6,
    },
    {
      code: LicensePlan.WHOLESALE_DESKTOP_LIFETIME,
      name: 'Wholesale Desktop Lifetime',
      description:
        'One-time desktop license. Unlimited desktop use for your wholesale POS (quotations, proforma & official invoices, bulk pricing) — download and activate your POS desktop app.',
      type: PlanType.ONE_TIME,
      businessType: BusinessType.WHOLESALE,
      monthlyPrice: null,
      yearlyPrice: null,
      oneTimePrice: '999.00',
      currency: 'USD',
      maxUsers: null,
      maxBranches: null,
      maxDevices: null,
      features: WHOLESALE_DESKTOP_LIFETIME_FEATURES,
      allowsDesktopDownload: true,
      isActive: true,
      sortOrder: 7,
    },
    {
      // Hybrid Desktop Lifetime is no longer offered. Kept (inactive) so the
      // enum value and any old records remain valid.
      code: LicensePlan.HYBRID_DESKTOP_LIFETIME,
      name: 'Hybrid Desktop Lifetime (discontinued)',
      description: 'Discontinued — no longer offered.',
      type: PlanType.ONE_TIME,
      businessType: BusinessType.HYBRID,
      monthlyPrice: null,
      yearlyPrice: null,
      oneTimePrice: '999.00',
      currency: 'USD',
      maxUsers: 8,
      maxBranches: 2,
      maxDevices: 4,
      features: STARTER_FEATURES,
      allowsDesktopDownload: true,
      isActive: false,
      sortOrder: 8,
    },
  ];

  for (const plan of plans) {
    const data = {
      name: plan.name,
      description: plan.description,
      type: plan.type,
      businessType: plan.businessType,
      monthlyPrice: plan.monthlyPrice ? new Prisma.Decimal(plan.monthlyPrice) : null,
      yearlyPrice: plan.yearlyPrice ? new Prisma.Decimal(plan.yearlyPrice) : null,
      oneTimePrice: plan.oneTimePrice ? new Prisma.Decimal(plan.oneTimePrice) : null,
      currency: plan.currency,
      maxUsers: plan.maxUsers,
      maxBranches: plan.maxBranches,
      maxDevices: plan.maxDevices,
      features: plan.features as Prisma.InputJsonValue,
      allowsDesktopDownload: plan.allowsDesktopDownload,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
    };

    await prisma.plan.upsert({
      where: { code: plan.code },
      create: { code: plan.code, ...data },
      update: data,
    });
  }
}

// BillingCycle is imported for future use in Phase 2 seed helpers
void (BillingCycle as unknown);

async function seedStoreSettings(clientId: string): Promise<void> {
  await prisma.storeSettings.upsert({
    where: { clientId },
    create: {
      clientId,
      storeName: 'Demo Store',
      taxEnabled: false,
      taxRate: new Prisma.Decimal(0),
      currency: 'USD',
      lowStockDefault: 5,
    },
    update: {
      storeName: 'Demo Store',
    },
  });
}

async function main(): Promise<void> {
  const passwordPlain = resolveAdminPasswordPlain();

  const client = await ensureDemoClient();
  const branch = await ensureMainBranch(client.id);
  const owner = await seedOwnerUser(client.id, passwordPlain);
  const cashier = await seedDemoCashierUser(client.id);

  await ensureUserBranch(owner.id, branch.id);
  if (cashier) {
    await ensureUserBranch(cashier.id, branch.id);
  }

  await seedCategories(client.id);
  await seedProducts(client.id, branch.id, owner.id);
  await seedStoreSettings(client.id);
  await seedPlans();
  await seedSaasPlatformAdmin();

  const usingEnvPassword = Boolean(process.env.SEED_ADMIN_PASSWORD?.trim());
  const nodeEnvLog =
    process.env.NODE_ENV === undefined || process.env.NODE_ENV === ''
      ? '(unset)'
      : process.env.NODE_ENV;

  const devCredentials =
    process.env.NODE_ENV === 'production'
      ? {
          adminUsername: 'admin',
          adminPasswordNote:
            'Value from SEED_ADMIN_PASSWORD (not printed for security).',
          demoCashierUsername: null as string | null,
          demoCashierPassword: null as string | null,
        }
      : {
          adminUsername: 'admin',
          adminPassword: passwordPlain,
          demoCashierUsername: 'cashier',
          demoCashierPassword: DEV_SEED_CASHIER_PASSWORD,
        };

  console.log(
    JSON.stringify({
      ok: true,
      message: 'Seed completed',
      clientSlug: DEMO_CLIENT_SLUG,
      branchCode: 'MAIN',
      categoriesSeeded: Object.keys(CATEGORY_IDS).length,
      productsSeeded: 8,
      passwordSource: usingEnvPassword ? 'env' : 'development-default',
      nodeEnv: nodeEnvLog,
      login: {
        clientSlug: DEMO_CLIENT_SLUG,
        ...devCredentials,
      },
    }),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
