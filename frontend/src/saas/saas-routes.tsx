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
import { LegacySaasNotFound } from '@/saas/components/LegacySaasNotFound';
import { HAS_CUSTOM_ADMIN_PATH, SAAS_ADMIN_BASE_PATH, saasPath } from '@/saas/config/saas-paths';

function SaasProtectedShell() {
  return (
    <SaasProtectedRoute>
      <SaasSessionGate>
        <Outlet />
      </SaasSessionGate>
    </SaasProtectedRoute>
  );
}

/**
 * Build the SaaS route tree under the configured base path.
 *
 * When `VITE_SUPER_ADMIN_BASE_PATH` is set to a non-default value, the
 * well-known `/saas/*` route is registered separately as a 404 page so the
 * old, guessable path stops working. We deliberately do NOT redirect from
 * `/saas/*` to the new path — that would leak the new path's location.
 */
export const saasRoutes = [
  { path: saasPath('/login'), element: <SaasLoginPage /> },
  {
    element: <SaasProtectedShell />,
    children: [
      {
        path: SAAS_ADMIN_BASE_PATH,
        element: <SaasLayout />,
        children: [
          { index: true, element: <Navigate to={saasPath('/dashboard')} replace /> },
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
  // Legacy 404 catchers — only attached when a custom path is configured.
  // (When the default `/saas` is still in use, the main tree above already
  // serves the same paths and we don't want to shadow them with 404s.)
  ...(HAS_CUSTOM_ADMIN_PATH
    ? [
        { path: '/saas', element: <LegacySaasNotFound /> },
        { path: '/saas/*', element: <LegacySaasNotFound /> },
      ]
    : []),
];
