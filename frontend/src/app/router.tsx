import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RoleRoute } from '@/components/auth/RoleRoute';
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
import { OfflineQueuePage } from '@/pages/OfflineQueuePage';
import { LoginPage } from '@/pages/LoginPage';
import CouponsPage from '@/pages/CouponsPage';
import { BillingPage } from '@/pages/BillingPage';
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
  { path: '/get-started', element: <GetStartedPage />, errorElement: <RouteErrorPage /> },
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
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'pos', element: <PosPage /> },
          { path: 'products', element: <ProductsPage /> },
          {
            path: 'product-labels',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN']}>
                <ProductLabelsPage />
              </RoleRoute>
            ),
          },
          {
            path: 'categories',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN']}>
                <CategoriesPage />
              </RoleRoute>
            ),
          },
          {
            path: 'stock-movements',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN']}>
                <StockMovementsPage />
              </RoleRoute>
            ),
          },
          {
            path: 'purchases',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN']}>
                <PurchasesPage />
              </RoleRoute>
            ),
          },
          {
            path: 'suppliers',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN']}>
                <SuppliersPage />
              </RoleRoute>
            ),
          },
          { path: 'sales', element: <SalesHistoryPage /> },
          {
            path: 'customers',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN', 'CASHIER']}>
                <CustomersPage />
              </RoleRoute>
            ),
          },
          {
            path: 'customers/:id',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN', 'CASHIER']}>
                <CustomerDetailPage />
              </RoleRoute>
            ),
          },
          {
            path: 'branches',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN', 'CASHIER']}>
                <BranchesPage />
              </RoleRoute>
            ),
          },
          {
            path: 'stock-transfers',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN']}>
                <StockTransfersPage />
              </RoleRoute>
            ),
          },
          {
            path: 'reports',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN']}>
                <ReportsPage />
              </RoleRoute>
            ),
          },
          {
            path: 'users',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN']}>
                <UsersPage />
              </RoleRoute>
            ),
          },
          {
            path: 'offline-queue',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN']}>
                <OfflineQueuePage />
              </RoleRoute>
            ),
          },
          {
            path: 'license',
            element: <LicenseStatusPage />,
          },
          {
            path: 'billing',
            element: (
              <RoleRoute allow={['OWNER']}>
                <BillingPage />
              </RoleRoute>
            ),
          },
          {
            path: 'coupons',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN']}>
                <CouponsPage />
              </RoleRoute>
            ),
          },
          {
            path: 'settings',
            element: (
              <RoleRoute allow={['OWNER', 'ADMIN']}>
                <SettingsPage />
              </RoleRoute>
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
