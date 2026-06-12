import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { ProductLabelsPage } from '@/pages/ProductLabelsPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { StockMovementsPage } from '@/pages/StockMovementsPage';
import { StockTransfersPage } from '@/pages/StockTransfersPage';
import { PurchasesPage } from '@/pages/PurchasesPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { SalesHistoryPage } from '@/pages/SalesHistoryPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { BranchesPage } from '@/pages/BranchesPage';
import { UsersPage } from '@/pages/UsersPage';
import { OfflineQueuePage } from '@/pages/OfflineQueuePage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotificationSettingsPage } from '@/pages/NotificationSettingsPage';
import { LicenseStatusPage } from '@/pages/LicenseStatusPage';
import { BillingPage } from '@/pages/BillingPage';
import { DownloadPage } from '@/pages/public/DownloadPage';
import { PosPage } from '@/pages/PosPage';
import { CreateOfficialInvoicePage } from '@/pages/wholesale/CreateOfficialInvoicePage';

/** Wholesale-prefixed routes that reuse shared store components. */
export const wholesaleSharedRouteChildren = [
  {
    path: 'wholesale/pos',
    element: (
      <ProtectedPage permission="pos:access" business="wholesale">
        <PosPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/sales',
    element: (
      <ProtectedPage permission="sales:view" business="wholesale">
        <SalesHistoryPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/products',
    element: (
      <ProtectedPage permission="products:view" business="wholesale">
        <ProductsPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/product-labels',
    element: (
      <ProtectedPage permission="product_labels:view" business="wholesale">
        <ProductLabelsPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/categories',
    element: (
      <ProtectedPage permission="categories:view" business="wholesale">
        <CategoriesPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/stock-movements',
    element: (
      <ProtectedPage permission="stock:view" business="wholesale">
        <StockMovementsPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/stock-transfers',
    element: (
      <ProtectedPage permission="stock:transfer" business="wholesale">
        <StockTransfersPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/purchases',
    element: (
      <ProtectedPage permission="purchase_orders:view" business="wholesale">
        <PurchasesPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/suppliers',
    element: (
      <ProtectedPage permission="suppliers:view" business="wholesale">
        <SuppliersPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/customers',
    element: (
      <ProtectedPage permission="customers:view" business="wholesale">
        <CustomersPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/customers/:id',
    element: (
      <ProtectedPage permission="customers:view" business="wholesale">
        <CustomerDetailPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/branches',
    element: (
      <ProtectedPage permission="branches:view" business="wholesale">
        <BranchesPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/users',
    element: (
      <ProtectedPage permission="users:view" business="wholesale">
        <UsersPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/offline-queue',
    element: (
      <ProtectedPage permission="settings:view" business="wholesale">
        <OfflineQueuePage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/shared-reports',
    element: (
      <ProtectedPage permission="reports:view" business="wholesale">
        <ReportsPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/settings',
    element: (
      <ProtectedPage permission="settings:view" business="wholesale">
        <SettingsPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/settings/notifications',
    element: (
      <ProtectedPage permission="notifications:view" business="wholesale">
        <NotificationSettingsPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/license',
    element: (
      <ProtectedPage permission="settings:view" business="wholesale">
        <LicenseStatusPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/billing',
    element: (
      <ProtectedPage permission="billing:view" business="wholesale">
        <BillingPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/download',
    element: (
      <ProtectedPage permission="billing:view" business="wholesale">
        <DownloadPage />
      </ProtectedPage>
    ),
  },
  {
    path: 'wholesale/invoices/new',
    element: (
      <ProtectedPage permission="official_invoices:create" business="wholesale">
        <CreateOfficialInvoicePage />
      </ProtectedPage>
    ),
  },
] as const;
