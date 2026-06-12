import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { fetchSaasClient } from '@/saas/api/saas-clients.api';
import { clientSubNav } from '@/saas/config/saas-navigation';
import { SaasQueryError, SaasTableSkeleton } from '@/saas/components/SaasQueryState';
import { SaasStatusBadge } from '@/saas/components/SaasStatusBadge';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { PageHeader } from '@/components/ui/page-header';
import { saasPath } from '@/saas/config/saas-paths';

export function SaasClientLayout() {
  const { id = '' } = useParams<{ id: string }>();
  const clientQ = useQuery({
    queryKey: ['saas', 'clients', id],
    queryFn: () => fetchSaasClient(id),
    enabled: Boolean(id),
  });

  const tabs = clientSubNav(id);
  const client = clientQ.data?.client;

  return (
    <div className="space-y-6">
      <PageHeader
        title={client?.businessName ?? 'Client'}
        description={client ? `${client.ownerName} · ${client.email}` : undefined}
        breadcrumbs={[
          { label: 'Clients', to: saasPath('/clients') },
          { label: client?.businessName ?? '…' },
        ]}
        actions={client ? <SaasStatusBadge status={client.status} /> : null}
      />

      {clientQ.isLoading ? <SaasTableSkeleton rows={2} /> : null}
      {clientQ.isError ? (
        <SaasQueryError message={getSaasApiErrorMessage(clientQ.error)} onRetry={() => clientQ.refetch()} />
      ) : null}

      {client ? (
        <>
          <nav className="flex flex-wrap gap-1 border-b border-line pb-1">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-t-lg px-4 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-surface text-primary-200'
                      : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                  )
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <Outlet context={{ clientDetail: clientQ.data } satisfies { clientDetail?: import('@/saas/types').SaasClientDetail }} />
        </>
      ) : null}
    </div>
  );
}

