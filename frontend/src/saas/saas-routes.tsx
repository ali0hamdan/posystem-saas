import { Navigate, Outlet } from 'react-router-dom';
import { SaasProtectedRoute } from '@/saas/components/SaasProtectedRoute';
import { SaasSessionGate } from '@/saas/components/SaasSessionGate';
import { SaasLayout } from '@/saas/layout/SaasLayout';
import { SaasClientLayout } from '@/saas/layout/SaasClientLayout';
import { SaasLoginPage } from '@/saas/pages/SaasLoginPage';
import { SaasDashboardPage } from '@/saas/pages/SaasDashboardPage';
import { SaasClientsListPage } from '@/saas/pages/SaasClientsListPage';
import { SaasClientOverviewPage } from '@/saas/pages/SaasClientOverviewPage';
import { SaasClientSubscriptionPage } from '@/saas/pages/SaasClientSubscriptionPage';
import { SaasClientUsersPage } from '@/saas/pages/SaasClientUsersPage';
import { SaasClientDevicesPage } from '@/saas/pages/SaasClientDevicesPage';
import { SaasClientActivationCodesPage } from '@/saas/pages/SaasClientActivationCodesPage';
import { SaasPlansPage } from '@/saas/pages/SaasPlansPage';
import { SaasDevicesPage } from '@/saas/pages/SaasDevicesPage';
import { SaasSubscriptionsPage } from '@/saas/pages/SaasSubscriptionsPage';
import { SaasActivationCodesPage } from '@/saas/pages/SaasActivationCodesPage';
import { SaasAuditLogsPage } from '@/saas/pages/SaasAuditLogsPage';
import { SaasSettingsPage } from '@/saas/pages/SaasSettingsPage';

function SaasProtectedShell() {
  return (
    <SaasProtectedRoute>
      <SaasSessionGate>
        <Outlet />
      </SaasSessionGate>
    </SaasProtectedRoute>
  );
}

export const saasRoutes = [
  { path: '/saas/login', element: <SaasLoginPage /> },
  {
    element: <SaasProtectedShell />,
    children: [
      {
        path: '/saas',
        element: <SaasLayout />,
        children: [
          { index: true, element: <Navigate to="/saas/dashboard" replace /> },
          { path: 'dashboard', element: <SaasDashboardPage /> },
          { path: 'clients', element: <SaasClientsListPage /> },
          { path: 'clients/expiring', element: <SaasClientsListPage mode="expiring" /> },
          { path: 'clients/suspended', element: <SaasClientsListPage mode="suspended" /> },
          { path: 'clients/pending', element: <SaasClientsListPage mode="pending" /> },
          { path: 'plans', element: <SaasPlansPage /> },
          { path: 'subscriptions', element: <SaasSubscriptionsPage /> },
          { path: 'activation-codes', element: <SaasActivationCodesPage /> },
          { path: 'devices', element: <SaasDevicesPage /> },
          { path: 'audit-logs', element: <SaasAuditLogsPage /> },
          { path: 'settings', element: <SaasSettingsPage /> },
          {
            path: 'clients/:id',
            element: <SaasClientLayout />,
            children: [
              { index: true, element: <SaasClientOverviewPage /> },
              { path: 'subscription', element: <SaasClientSubscriptionPage /> },
              { path: 'users', element: <SaasClientUsersPage /> },
              { path: 'devices', element: <SaasClientDevicesPage /> },
              { path: 'activation-codes', element: <SaasClientActivationCodesPage /> },
            ],
          },
        ],
      },
    ],
  },
];
