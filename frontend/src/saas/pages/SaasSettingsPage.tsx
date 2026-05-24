import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { SaasCard } from '@/saas/components/SaasCard';
import { useSaasAuthStore } from '@/saas/stores/saas-auth-store';


export function SaasSettingsPage() {
  const admin = useSaasAuthStore((s) => s.admin);

  return (
    <div className="space-y-6">
      <PageHeader title="Platform settings" description="Global configuration for the SaaS operator console." />
      <SaasCard title="Your operator account">
        <dl className="space-y-2 text-sm">
          <Row label="Name" value={admin?.name ?? '—'} />
          <Row label="Email" value={admin?.email ?? '—'} />
          <Row label="Role" value={admin?.role ?? '—'} />
        </dl>
      </SaasCard>
      <SaasCard>
        <EmptyState
          icon={Settings}
          title="Platform settings"
          description="JWT secrets, rate limits, and email templates are configured via backend environment variables. A settings API may be added later."
          className="border-line bg-surface"
        />
      </SaasCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
