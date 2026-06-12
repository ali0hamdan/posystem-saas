import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { SessionGate } from '@/components/auth/SessionGate';
import { ActivateLicensePage } from '@/pages/ActivateLicensePage';
import { LicenseStatusPage } from '@/pages/LicenseStatusPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PricingPage } from '@/pages/public/PricingPage';
import { RegisterPage } from '@/pages/public/RegisterPage';
import { GetStartedPage } from '@/pages/public/GetStartedPage';
import { PaymentPage } from '@/pages/public/PaymentPage';
import { PaymentSuccessPage } from '@/pages/public/PaymentSuccessPage';
import { PaymentCancelledPage } from '@/pages/public/PaymentCancelledPage';
import { VerifyEmailPage } from '@/pages/public/VerifyEmailPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { DownloadPage } from '@/pages/public/DownloadPage';
import { LandingPage } from '@/pages/public/LandingPage';
import { PosPage } from '@/pages/PosPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { ProductLabelsPage } from '@/pages/ProductLabelsPage';
import { BranchesPage } from '@/pages/BranchesPage';
import { StockTransfersPage } from '@/pages/StockTransfersPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { StockMovementsPage } from '@/pages/StockMovementsPage';
import { PurchasesPage } from '@/pages/PurchasesPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { SalesHistoryPage } from '@/pages/SalesHistoryPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { UsersPage } from '@/pages/UsersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotificationSettingsPage } from '@/pages/NotificationSettingsPage';
import { RefundsPage } from '@/pages/RefundsPage';
import { RefundPrintPage } from '@/pages/RefundPrintPage';
import { OfflineQueuePage } from '@/pages/OfflineQueuePage';
import { CommissionsPage } from '@/pages/CommissionsPage';
import { LoginPage } from '@/pages/LoginPage';
import CouponsPage from '@/pages/CouponsPage';
import { QuotationsPage } from '@/pages/QuotationsPage';
import { ProformaInvoicesPage } from '@/pages/ProformaInvoicesPage';
import { BillingPage } from '@/pages/BillingPage';
import { wholesaleSharedRouteChildren } from '@/app/wholesale-shared-routes';
import { FnbDashboardPage } from '@/pages/fnb/FnbDashboardPage';
import { FnbPosPage } from '@/pages/fnb/FnbPosPage';
import { FnbTablesPage } from '@/pages/fnb/FnbTablesPage';
import { FnbMenuPage } from '@/pages/fnb/FnbMenuPage';
import { FnbModifiersPage } from '@/pages/fnb/FnbModifiersPage';
import { FnbKitchenPage } from '@/pages/fnb/FnbKitchenPage';
import { FnbRecipesPage } from '@/pages/fnb/FnbRecipesPage';
import { FnbIngredientsPage } from '@/pages/fnb/FnbIngredientsPage';
import { FnbReservationsPage } from '@/pages/fnb/FnbReservationsPage';
import { FnbReportsPage } from '@/pages/fnb/FnbReportsPage';
import { FnbWastePage } from '@/pages/fnb/FnbWastePage';
import { FnbDeliveryPage } from '@/pages/fnb/FnbDeliveryPage';
import { WholesaleDashboardPage } from '@/pages/wholesale/WholesaleDashboardPage';
import { BulkPricingPage } from '@/pages/wholesale/BulkPricingPage';
import { DeliveryNotesPage } from '@/pages/wholesale/DeliveryNotesPage';
import { PaymentTermsPage } from '@/pages/wholesale/PaymentTermsPage';
import { CustomerStatementsPage } from '@/pages/wholesale/CustomerStatementsPage';
import { StockReservationsPage } from '@/pages/wholesale/StockReservationsPage';
import { WholesaleReportsPage } from '@/pages/wholesale/WholesaleReportsPage';
import { B2bPrintPage } from '@/pages/wholesale/B2bPrintPage';
import { saasRoutes } from '@/saas/saas-routes';

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <SessionGate>
        <Outlet />
      </SessionGate>
    </ProtectedRoute>
  );
}

const router = createBrowserRouter([
  { path: '/', element: <LandingPage />, errorElement: <RouteErrorPage /> },
  { path: '/activate', element: <ActivateLicensePage />, errorElement: <RouteErrorPage /> },
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage />, errorElement: <RouteErrorPage /> },
  { path: '/reset-password', element: <ResetPasswordPage />, errorElement: <RouteErrorPage /> },
  { path: '/get-started', element: <GetStartedPage />, errorElement: <RouteErrorPage /> },
  { path: '/verify-email', element: <VerifyEmailPage />, errorElement: <RouteErrorPage /> },
  { path: '/pricing', element: <PricingPage />, errorElement: <RouteErrorPage /> },
  { path: '/register', element: <RegisterPage />, errorElement: <RouteErrorPage /> },
  { path: '/payment', element: <PaymentPage />, errorElement: <RouteErrorPage /> },
  { path: '/payment-success', element: <PaymentSuccessPage />, errorElement: <RouteErrorPage /> },
  { path: '/payment-cancelled', element: <PaymentCancelledPage />, errorElement: <RouteErrorPage /> },
  { path: '/download', element: <DownloadPage />, errorElement: <RouteErrorPage /> },
  ...saasRoutes,
  {
    element: <ProtectedLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: 'dashboard',
            element: (
              <ProtectedPage permission="dashboard:view" business="retail">
                <DashboardPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'pos',
            element: (
              <ProtectedPage permission="pos:access" business="retail">
                <PosPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'products',
            element: (
              <ProtectedPage permission="products:view">
                <ProductsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'product-labels',
            element: (
              <ProtectedPage permission="product_labels:view" business="retail">
                <ProductLabelsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'categories',
            element: (
              <ProtectedPage permission="categories:view">
                <CategoriesPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'stock-movements',
            element: (
              <ProtectedPage permission="stock:view">
                <StockMovementsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'purchases',
            element: (
              <ProtectedPage permission="purchase_orders:view">
                <PurchasesPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'suppliers',
            element: (
              <ProtectedPage permission="suppliers:view">
                <SuppliersPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'sales',
            element: (
              <ProtectedPage permission="sales:view">
                <SalesHistoryPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'commissions',
            element: (
              <ProtectedPage permission={['commissions:view', 'commissions:view_own']}>
                <CommissionsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'refunds',
            element: (
              <ProtectedPage permission="refunds:view">
                <RefundsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'refunds/:id/print',
            element: (
              <ProtectedPage permission="refunds:print">
                <RefundPrintPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'sales/:id/print',
            element: (
              <ProtectedPage permission="sales:print">
                <B2bPrintPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'customers',
            element: (
              <ProtectedPage permission="customers:view">
                <CustomersPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'customers/:id',
            element: (
              <ProtectedPage permission="customers:view">
                <CustomerDetailPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'branches',
            element: (
              <ProtectedPage permission="branches:view">
                <BranchesPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'stock-transfers',
            element: (
              <ProtectedPage permission="stock:transfer">
                <StockTransfersPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'reports',
            element: (
              <ProtectedPage permission="reports:view">
                <ReportsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'users',
            element: (
              <ProtectedPage permission="users:view">
                <UsersPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'offline-queue',
            element: (
              <ProtectedPage permission="settings:view">
                <OfflineQueuePage />
              </ProtectedPage>
            ),
          },
          {
            path: 'license',
            element: (
              <ProtectedPage permission="settings:view">
                <LicenseStatusPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'billing',
            element: (
              <ProtectedPage permission="billing:view">
                <BillingPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'coupons',
            element: (
              <ProtectedPage permission="settings:view" business="retail">
                <CouponsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'quotations',
            element: (
              <ProtectedPage permission="quotations:view">
                <QuotationsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'quotations/:id/print',
            element: (
              <ProtectedPage permission="quotations:print">
                <B2bPrintPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'proforma-invoices',
            element: (
              <ProtectedPage permission="proforma:view">
                <ProformaInvoicesPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'proforma-invoices/:id/print',
            element: (
              <ProtectedPage permission="proforma:print">
                <B2bPrintPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'fnb/dashboard',
            element: (
              <ProtectedPage permission="fnb:access" business="fnb">
                <FnbDashboardPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'fnb/pos',
            element: (
              <ProtectedPage permission="fnb:access" business="fnb">
                <FnbPosPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'fnb/tables',
            element: (
              <ProtectedPage permission="tables:view" business="fnb">
                <FnbTablesPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'fnb/kitchen',
            element: (
              <ProtectedPage permission="kitchen:view" business="fnb">
                <FnbKitchenPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'fnb/menu',
            element: (
              <ProtectedPage permission="menu:view" business="fnb">
                <FnbMenuPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'fnb/modifiers',
            element: (
              <ProtectedPage permission="menu:view" business="fnb">
                <FnbModifiersPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'fnb/ingredients',
            element: (
              <ProtectedPage permission="ingredients:view" business="fnb">
                <FnbIngredientsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'fnb/recipes',
            element: (
              <ProtectedPage permission="menu:view" business="fnb">
                <FnbRecipesPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'fnb/waste',
            element: (
              <ProtectedPage permission="ingredients:view" business="fnb">
                <FnbWastePage />
              </ProtectedPage>
            ),
          },
          {
            path: 'fnb/delivery',
            element: (
              <ProtectedPage permission="fnb_orders:view" business="fnb">
                <FnbDeliveryPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'fnb/reservations',
            element: (
              <ProtectedPage permission="fnb_orders:view" business="fnb">
                <FnbReservationsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'fnb/reports',
            element: (
              <ProtectedPage permission="reports:view" business="fnb">
                <FnbReportsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/dashboard',
            element: (
              <ProtectedPage permission="wholesale:access" business="wholesale">
                <WholesaleDashboardPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/quotations',
            element: (
              <ProtectedPage permission="quotations:view" business="wholesale">
                <QuotationsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/quotations/:id/print',
            element: (
              <ProtectedPage permission="quotations:print" business="wholesale">
                <B2bPrintPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/proforma-invoices',
            element: (
              <ProtectedPage permission="proforma:view" business="wholesale">
                <ProformaInvoicesPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/proforma-invoices/:id/print',
            element: (
              <ProtectedPage permission="proforma:print" business="wholesale">
                <B2bPrintPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/invoices',
            element: (
              <ProtectedPage permission="official_invoices:view" business="wholesale">
                <SalesHistoryPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/invoices/:id/print',
            element: (
              <ProtectedPage permission="official_invoices:print" business="wholesale">
                <B2bPrintPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/bulk-pricing',
            element: (
              <ProtectedPage permission="bulk_pricing:view" business="wholesale">
                <BulkPricingPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/delivery-notes',
            element: (
              <ProtectedPage permission="delivery_notes:view" business="wholesale">
                <DeliveryNotesPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/payment-terms',
            element: (
              <ProtectedPage permission="customers:view" business="wholesale">
                <PaymentTermsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/customer-statements',
            element: (
              <ProtectedPage permission="customer_statements:view" business="wholesale">
                <CustomerStatementsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/stock-reservations',
            element: (
              <ProtectedPage permission="stock_reservations:view" business="wholesale">
                <StockReservationsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/reports',
            element: (
              <ProtectedPage permission="reports:view" business="wholesale">
                <WholesaleReportsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'wholesale/commissions',
            element: (
              <ProtectedPage permission={['commissions:view', 'commissions:view_own']} business="wholesale">
                <CommissionsPage />
              </ProtectedPage>
            ),
          },
          ...wholesaleSharedRouteChildren,
          {
            path: 'settings',
            element: (
              <ProtectedPage permission="settings:view">
                <SettingsPage />
              </ProtectedPage>
            ),
          },
          {
            path: 'settings/notifications',
            element: (
              <ProtectedPage permission="notifications:view">
                <NotificationSettingsPage />
              </ProtectedPage>
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
