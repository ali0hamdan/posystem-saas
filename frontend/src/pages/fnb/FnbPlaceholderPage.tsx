import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

export function FnbPlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface p-8 text-center">
        <Construction className="h-10 w-10 text-ink-faint" />
        <p className="mt-3 text-sm text-ink-muted">This module is coming in a future release.</p>
      </div>
    </div>
  );
}
